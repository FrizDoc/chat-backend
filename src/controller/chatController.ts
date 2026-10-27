import type { Request, Response } from "express";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { chats, chatMembers, users } from "../db/schema.js";
import { createMessage, getMessages, markMessageRead, updateLastSeen } from "../services/message.service.js";
import { isUuid } from "../utils/validation.js";

export const createOrGetChat = async (req: Request, res: Response) => {
  const { userAId, userBId } = req.body ?? {};

  if (!isUuid(userAId) || !isUuid(userBId)) {
    return res.status(400).json({ message: "userAId and userBId must be valid UUIDs" });
  }

  if (userAId === userBId) {
    return res.status(400).json({ message: "userAId and userBId must be different" });
  }

  const existingUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.id, [userAId, userBId]));

  if (existingUsers.length !== 2) {
    return res.status(404).json({ message: "One or both users not found" });
  }

  const pairKey = [userAId, userBId].sort().join(":");

  const result = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${pairKey}))`);

    const [existing] = await tx
      .select({ chatId: chatMembers.chatId })
      .from(chatMembers)
      .innerJoin(chats, eq(chats.id, chatMembers.chatId))
      .where(
        and(
          eq(chats.type, "DIRECT"),
          inArray(chatMembers.userId, [userAId, userBId]),
        ),
      )
      .groupBy(chatMembers.chatId)
      .having(sql`count(distinct ${chatMembers.userId}) = 2`)
      .limit(1);

    if (existing) {
      return { chatId: existing.chatId, created: false };
    }

    const [chat] = await tx
      .insert(chats)
      .values({ type: "DIRECT" })
      .returning({ id: chats.id });

    if (!chat) {
      throw new Error("Failed to create chat");
    }

    await tx.insert(chatMembers).values([
      { chatId: chat.id, userId: userAId },
      { chatId: chat.id, userId: userBId },
    ]);

    return { chatId: chat.id, created: true };
  });

  return res.status(result.created ? 201 : 200).json({ chatId: result.chatId });
};


export const sendMessage = async (req: Request, res: Response) => {
  try {
    const chatId = req.params.chatId
    const { senderId, text } = req.body ?? {};

    if (!isUuid(chatId)) {
      return res.status(400).json({ message: "The chat id must be a valid UUID!" })
    }
    if (!isUuid(senderId)) {
      return res.status(400).json({ message: "The sender id must be a valid UUID!" })
    }
    if (typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ message: "The text must be a non empty string" })
    }
    const content = text.trim();
    const [membership] = await db
      .select({ userId: chatMembers.userId })
      .from(chatMembers)
      .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, senderId)))
      .limit(1);

    if (!membership) {
      return res.status(403).json({ message: "Sender is not a member of this chat" });
    }

    const message = await createMessage({ chatId, senderId, content });

    await db
      .update(chats)
      .set({ updatedAt: new Date() })
      .where(eq(chats.id, chatId));

    return res.status(201).json(message);
  } catch (err) {
    console.error("sendMessage failed", err);
    return res.status(500).json({ message: "Failed to send message" });
  }
}

const DEFAULT_MESSAGE_LIMIT = 50;
const MAX_MESSAGE_LIMIT = 100;

export const getChatMessages = async (req: Request, res: Response) => {
  try {
    const chatId = req.params.chatId;

    if (!isUuid(chatId)) {
      return res.status(400).json({ message: "The chat id must be a valid UUID!" })
    }

    let limit = DEFAULT_MESSAGE_LIMIT;
    if (req.query.limit !== undefined) {
      limit = Number(req.query.limit);
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_MESSAGE_LIMIT) {
        return res.status(400).json({ message: `limit must be an integer between 1 and ${MAX_MESSAGE_LIMIT}` })
      }
    }

    const [chat] = await db
      .select({ id: chats.id })
      .from(chats)
      .where(eq(chats.id, chatId))
      .limit(1);

    if (!chat) {
      return res.status(404).json({ message: "Chat not found" });
    }

    const messages = await getMessages(chatId, limit);

    return res.status(200).json({ messages });
  } catch (err) {
    console.error("getChatMessages failed", err);
    return res.status(500).json({ message: "Failed to fetch messages" });
  }
}


const FIRESTORE_ID_REGEX = /^[A-Za-z0-9]{1,128}$/;

export const markChatMessageRead = async (req: Request, res: Response) => {
  try {
    const { chatId, messageId } = req.params;
    const { userId } = req.body ?? {};

    if (!isUuid(chatId)) {
      return res.status(400).json({ message: "The chat id must be a valid UUID!" })
    }
    if (typeof messageId !== "string" || !FIRESTORE_ID_REGEX.test(messageId)) {
      return res.status(400).json({ message: "The message id is invalid!" })
    }
    if (!isUuid(userId)) {
      return res.status(400).json({ message: "The user id must be a valid UUID!" })
    }

    const [membership] = await db
      .select({ userId: chatMembers.userId })
      .from(chatMembers)
      .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)))
      .limit(1);

    if (!membership) {
      return res.status(403).json({ message: "User is not a member of this chat" });
    }

    const result = await markMessageRead(chatId, messageId, userId);

    if (!result) {
      return res.status(404).json({ message: "Message not found" });
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error("markChatMessageRead failed", err);
    return res.status(500).json({ message: "Failed to mark message as read" });
  }
}

export const updateChatLastSeen = async (req: Request, res: Response) => {
  try {
    const chatId = req.params.chatId;
    const { userId, messageId } = req.body ?? {};

    if (!isUuid(chatId)) {
      return res.status(400).json({ message: "The chat id must be a valid UUID!" })
    }
    if (!isUuid(userId)) {
      return res.status(400).json({ message: "The user id must be a valid UUID!" })
    }
    if (typeof messageId !== "string" || !FIRESTORE_ID_REGEX.test(messageId)) {
      return res.status(400).json({ message: "The message id is invalid!" })
    }

    const [membership] = await db
      .select({ userId: chatMembers.userId })
      .from(chatMembers)
      .where(and(eq(chatMembers.chatId, chatId), eq(chatMembers.userId, userId)))
      .limit(1);

    if (!membership) {
      return res.status(403).json({ message: "User is not a member of this chat" });
    }

    const result = await updateLastSeen(chatId, userId, messageId);

    if (!result) {
      return res.status(404).json({ message: "Message not found" });
    }

    return res.status(200).json(result);
  } catch (err) {
    console.error("updateChatLastSeen failed", err);
    return res.status(500).json({ message: "Failed to update last seen" });
  }
}
