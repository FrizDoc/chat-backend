# Chat Backend

1:1 chat backend in Node.js + TypeScript.

Users and chats are stored in PostgreSQL (Drizzle ORM). Messages, read receipts and last seen are stored in Firebase Firestore.

## Setup

You need Node 20+, a Postgres database and a Firebase project with Firestore enabled.

```bash
npm install
cp .env.example .env
```

Fill in `.env`:

```
DATABASE_URL=postgres://postgres:postgres@localhost:5432/chat_db
PORT=4000
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
```

The Firebase values come from the service account JSON (Firebase console > Project settings > Service accounts > Generate new private key). Keep the private key in double quotes.

Run migrations and start the server:

```bash
npm run db:migrate
npm run dev
```

There is no signup API, so add a few users yourself to test with:

```sql
INSERT INTO users (name, email) VALUES
  ('Asha', 'asha@example.com'),
  ('Rahul', 'rahul@example.com')
RETURNING id;
```

You can also use `npm run db:studio`.

## APIs

### Create or get chat

`POST /chat/create`

```json
{ "userAId": "uuid", "userBId": "uuid" }
```

Returns `{ "chatId": "..." }`. If the two users already have a chat, the same chat is returned.

### Send message

`POST /chat/:chatId/message/send`

```json
{ "senderId": "uuid", "text": "hello" }
```

Saves the message in Firestore and returns it. The sender must be a member of the chat.

### Get messages

`GET /chat/:chatId/messages?limit=50`

Returns the latest messages, oldest first. `limit` defaults to 50, max 100.

### Mark message read

`POST /chat/:chatId/message/:messageId/read`

```json
{ "userId": "uuid" }
```

Adds the user to the message's `readBy` list. When someone other than the sender reads it, `isRead` and `readAt` are set too. The user must be a member of the chat.

### Update last seen

`POST /chat/:chatId/lastseen`

```json
{ "userId": "uuid", "messageId": "firestore-message-id" }
```

Saves the last message a user has seen in the chat. It won't go back to an older message.

### List user chats

`GET /user/:userId/chats`

Returns the user's chats, most recent first. Each chat has a `members` list with the id and name of everyone in it, including the user.

## Data

Postgres tables: `users`, `chats`, `chat_members`.

Firestore:

```
chats/{chatId}/messages/{messageId}
chats/{chatId}/lastSeen/{userId}
```

The Firestore chat id is the same as the Postgres chat id.

## Scripts

```bash
npm run dev          # start with reload
npm run build        # compile to dist/
npm start            # run the build
npm run typecheck
npm run db:generate  # new migration from schema changes
npm run db:migrate
npm run db:studio
```

## Notes

- There is no auth. User ids are taken from the request. There's an unused Firebase auth middleware in `src/middlewares` if needed later.
- Only the latest page of messages can be fetched, there's no pagination yet.
