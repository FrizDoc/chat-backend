import { firestore } from "../config/firebase.js";

interface CreateMessageInput {
  chatId: string;
  senderId: string;
  content: string;
}

export async function createMessage(
  input: CreateMessageInput,
) {
  const messagesRef = firestore
    .collection("chats")
    .doc(input.chatId)
    .collection("messages");

  const messageRef = messagesRef.doc();

  const message = {
    senderId: input.senderId,
    content: input.content,
    type: "text",
    createdAt: new Date(),
    updatedAt: null,
    readBy: [input.senderId],
  };

  await messageRef.set(message);

  return {
    id: messageRef.id,
    ...message,
  };
}

export async function getMessages(chatId: string, limit: number) {
  const snapshot = await firestore
    .collection("chats")
    .doc(chatId)
    .collection("messages")
    .orderBy("createdAt", "desc")
    .limit(limit)
    .get();

  return snapshot.docs
    .map((doc) => {
      const data = doc.data();
      return {
        id: doc.id,
        senderId: data.senderId,
        content: data.content,
        type: data.type,
        createdAt: data.createdAt?.toDate?.() ?? null,
        updatedAt: data.updatedAt?.toDate?.() ?? null,
        readBy: data.readBy ?? [],
      };
    })
    .reverse();
}
