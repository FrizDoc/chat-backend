import express from "express"
import { register, login, me } from "../controllers/authController.js"
import { authenticate } from "../middlewares/authMiddleware.js"

const authRouter = express.Router()

authRouter.post("/register", register)
authRouter.post("/login", login)
authRouter.get("/me", authenticate, me)

export default authRouter
