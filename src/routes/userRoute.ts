import express from "express"
import { getUserChats } from "../controller/userController.js"

const userRouter = express.Router()

userRouter.get("/:userId/chats", getUserChats)

export default userRouter
