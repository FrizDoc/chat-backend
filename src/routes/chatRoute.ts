import express from "express"
import { createOrGetChat, getChatMessages, sendMessage } from "../controller/chatController.js"

const chatRouter = express.Router()

chatRouter.post("/create", createOrGetChat)
chatRouter.post("/:chatId/messages", sendMessage)
chatRouter.get("/:chatId/messages", getChatMessages)

export default chatRouter
