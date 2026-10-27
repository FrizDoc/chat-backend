import express from "express"
import helmet from "helmet"
import type { Request, Response, NextFunction } from "express"
import chatRouter from "./routes/chatRoute.js"

const app = express()

app.use(helmet());
app.use(express.json())

app.get('/', (req: Request, res: Response) => {
  res.json({
    message: "Hello from chat backend"
  })
})

app.use("/api/chats", chatRouter)

app.use((_req: Request, res: Response) => {
  res.status(404).json({ message: "Route not found" })
})

app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err)
  res.status(500).json({ message: "Internal server error" })
})

export default app
