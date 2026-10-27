import app from "./src/app.js"

const PORT = Number(process.env.PORT) || 4000

app.listen(PORT, (error) => {
  if (error) {
    console.error(`Failed to start server on port ${PORT}:`, error.message)
    process.exit(1)
  }

  console.log(`Chat backend running on http://localhost:${PORT}`)
})
