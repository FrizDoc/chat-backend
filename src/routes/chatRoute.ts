import express from "express"
import { createOrGetChat } from "../controller/chatController.js"

const chatRouter = express.Router()

chatRouter.post("/create", createOrGetChat)

export default chatRouter
