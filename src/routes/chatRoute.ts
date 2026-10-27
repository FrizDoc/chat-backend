import express from "express"
import { createOrGetChat, getChatMessages, markChatMessageRead, sendMessage } from "../controller/chatController.js"

const chatRouter = express.Router()

chatRouter.post("/create", createOrGetChat)
chatRouter.post("/:chatId/messages", sendMessage)
chatRouter.get("/:chatId/messages", getChatMessages)
chatRouter.patch("/:chatId/messages/:messageId/read", markChatMessageRead)

export default chatRouter
