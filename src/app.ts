import express from "express"
import helmet from "helmet"
import type { Request, Response, NextFunction } from "express"
import authRouter from "./routes/authRoute.js"
import chatRouter from "./routes/chatRoute.js"
import { authenticate } from "./middlewares/authMiddleware.js"

const app = express()

app.use(helmet());
app.use(express.json())

app.get('/', (req: Request, res: Response) => {
  res.json({
    message: "Hello from chat backend"
  })
})

app.use("/api/auth", authRouter)
app.use("/api/chats", authenticate, chatRouter)

app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" })
})

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err)
  res.status(500).json({ message: "Internal server error" })
})

export default app
