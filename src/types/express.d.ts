export interface AuthUser {
  id: string;
  firebaseUid: string;
}

declare global {
  namespace Express {
    interface Request {
      // Set by requireAuth; present on every route mounted behind it
      user?: AuthUser;
    }
  }
}
