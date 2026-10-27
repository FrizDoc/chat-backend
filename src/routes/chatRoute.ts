import express from "express"
import { createOrGetChat, getChatMessages, markChatMessageRead, sendMessage, updateChatLastSeen } from "../controller/chatController.js"

const chatRouter = express.Router()

chatRouter.post("/create", createOrGetChat)
chatRouter.post("/:chatId/message/send", sendMessage)
chatRouter.get("/:chatId/messages", getChatMessages)
chatRouter.post("/:chatId/message/:messageId/read", markChatMessageRead)
chatRouter.post("/:chatId/lastseen", updateChatLastSeen)

export default chatRouter
