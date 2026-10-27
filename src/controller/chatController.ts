import type { Request, Response } from "express";
import { and, eq, inArray, sql } from "drizzle-orm";
import { db } from "../db/index.js";
import { chats, chatMembers, users } from "../db/schema.js";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const isUuid = (value: unknown): value is string =>
  typeof value === "string" && UUID_REGEX.test(value);

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
