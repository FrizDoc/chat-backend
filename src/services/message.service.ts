import { FieldValue } from "firebase-admin/firestore";
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

export async function markMessageRead(
  chatId: string,
  messageId: string,
  userId: string,
) {
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

    const readBy: string[] = snapshot.get("readBy") ?? [];
    let isRead: boolean = snapshot.get("isRead") === true;
    let readAt: Date | null = snapshot.get("readAt")?.toDate?.() ?? null;

    if (!readBy.includes(userId)) {
      readBy.push(userId);
    }

    // The sender reading their own message doesn't make it "read" for the chat
    if (!isRead && userId !== snapshot.get("senderId")) {
      isRead = true;
      readAt = new Date();
    }

    tx.update(messageRef, { readBy: FieldValue.arrayUnion(userId), isRead, readAt });

    return { id: messageRef.id, readBy, isRead, readAt };
  });
}

export async function updateLastSeen(
  chatId: string,
  userId: string,
  messageId: string,
) {
  const chatRef = firestore.collection("chats").doc(chatId);
  const messageRef = chatRef.collection("messages").doc(messageId);
  const lastSeenRef = chatRef.collection("lastSeen").doc(userId);

  return firestore.runTransaction(async (tx) => {
    const [message, current] = await Promise.all([
      tx.get(messageRef),
      tx.get(lastSeenRef),
    ]);

    if (!message.exists) {
      return null;
    }

    const messageCreatedAt: Date | null = message.get("createdAt")?.toDate?.() ?? null;
    const currentCreatedAt: Date | null = current.get("messageCreatedAt")?.toDate?.() ?? null;


    if (
      current.exists &&
      currentCreatedAt &&
      messageCreatedAt &&
      currentCreatedAt >= messageCreatedAt
    ) {
      return {
        userId,
        messageId: current.get("messageId") as string,
        seenAt: current.get("seenAt")?.toDate?.() ?? null,
        updated: false,
      };
    }

    const seenAt = new Date();
    tx.set(lastSeenRef, { messageId, messageCreatedAt, seenAt });

    return { userId, messageId, seenAt, updated: true };
  });
}
