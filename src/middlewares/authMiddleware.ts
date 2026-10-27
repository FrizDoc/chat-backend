import type { Request, Response, NextFunction } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import { eq } from "drizzle-orm";
import { firebaseAuth } from "../config/firebase.js";
import { db } from "../db/index.js";
import { users } from "../db/schema.js";

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const header = req.headers.authorization;

  if (!header?.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Missing Authorization bearer token" });
  }

  let decoded: DecodedIdToken;
  try {
    decoded = await firebaseAuth.verifyIdToken(header.slice("Bearer ".length));
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  if (!decoded.email) {
    return res.status(403).json({ message: "Firebase account must have an email" });
  }

  let [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, decoded.email))
    .limit(1);

  // First request from this Firebase account: create its Postgres user, matched by email.
  // onConflictDoUpdate covers two first requests racing each other.
  if (!user) {
    [user] = await db
      .insert(users)
      .values({
        email: decoded.email,
        name: decoded.name ?? decoded.email,
      })
      .onConflictDoUpdate({
        target: users.email,
        set: { updatedAt: new Date() },
      })
      .returning({ id: users.id });
  }

  if (!user) {
    throw new Error("Failed to resolve user");
  }

  req.user = { id: user.id, firebaseUid: decoded.uid };
  next();
};
