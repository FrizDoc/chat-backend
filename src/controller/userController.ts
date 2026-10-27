import type { Request, Response } from "express";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "../db/index.js";
import { chats, chatMembers, users } from "../db/schema.js";
import { isUuid } from "../utils/validation.js";

interface ChatMember {
  id: string;
  name: string;
  email: string;
}

interface UserChat {
  id: string;
  type: "DIRECT" | "GROUP";
  createdAt: Date;
  updatedAt: Date;
  members: ChatMember[];
}

export const getUserChats = async (req: Request, res: Response) => {
  try {
    const userId = req.params.userId;

    if (!isUuid(userId)) {
      return res.status(400).json({ message: "The user id must be a valid UUID!" })
    }

    const [user] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const userChatIds = db
      .select({ chatId: chatMembers.chatId })
      .from(chatMembers)
      .where(eq(chatMembers.userId, userId));

    // One row per (chat, member); most recently active chats first
    const rows = await db
      .select({
        chatId: chats.id,
        type: chats.type,
        createdAt: chats.createdAt,
        updatedAt: chats.updatedAt,
        memberId: users.id,
        memberName: users.name,
        memberEmail: users.email,
      })
      .from(chats)
      .innerJoin(chatMembers, eq(chatMembers.chatId, chats.id))
      .innerJoin(users, eq(users.id, chatMembers.userId))
      .where(inArray(chats.id, userChatIds))
      .orderBy(desc(chats.updatedAt), chats.id);

    // Map keeps insertion order, so the updatedAt ordering survives grouping
    const chatsById = new Map<string, UserChat>();
    for (const row of rows) {
      let chat = chatsById.get(row.chatId);
      if (!chat) {
        chat = {
          id: row.chatId,
          type: row.type,
          createdAt: row.createdAt,
          updatedAt: row.updatedAt,
          members: [],
        };
        chatsById.set(row.chatId, chat);
      }

      // Only list the other participants; the caller already knows who they are
      if (row.memberId !== userId) {
        chat.members.push({ id: row.memberId, name: row.memberName, email: row.memberEmail });
      }
    }

    return res.status(200).json({ chats: [...chatsById.values()] });
  } catch (err) {
    console.error("getUserChats failed", err);
    return res.status(500).json({ message: "Failed to fetch chats" });
  }
}
