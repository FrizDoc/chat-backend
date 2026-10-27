import express from "express"
import helmet from "helmet"
import type { Request, Response } from "express"

const app = express()

app.use(helmet());
app.use(express.json())

app.get('/', (req: Request, res: Response) => {
  res.json({
    message: "Hello from chat backend"
  })
})

export default app
