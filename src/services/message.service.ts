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
    isRead: false,
    readAt: null,
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
        isRead: data.isRead ?? false,
        readAt: data.readAt?.toDate?.() ?? null,
      };
    })
    .reverse();
}

export async function markMessageRead(chatId: string, messageId: string) {
  const messageRef = firestore
    .collection("chats")
    .doc(chatId)
    .collection("messages")
    .doc(messageId);

  return firestore.runTransaction(async (tx) => {
    const snapshot = await tx.get(messageRef);
    if (!snapshot.exists) {
      return null;
    }
    if (snapshot.get("isRead") === true) {
      return {
        id: messageRef.id,
        isRead: true,
        readAt: snapshot.get("readAt")?.toDate?.() ?? null,
      };
    }

    const readAt = new Date();
    tx.update(messageRef, { isRead: true, readAt });

    return { id: messageRef.id, isRead: true, readAt };
  });
}
