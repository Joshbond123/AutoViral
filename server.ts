import express from "express"
  import { createServer as createViteServer } from "vite"
  import path from "path"
  import { fileURLToPath } from "url"
  import dotenv from "dotenv"
  import { createClient } from "@supabase/supabase-js"

  dotenv.config()
  const __filename = fileURLToPath(import.meta.url)
  const __dirname = path.dirname(__filename)

  async function startServer() {
    const app = express()
    const PORT = 3000
    app.use(express.json())

    const supabaseUrl = process.env.SUPABASE_URL || "https://aprwenafjyruidxmafkx.supabase.co"
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || ""
    const supabase = createClient(supabaseUrl, supabaseKey)

    app.get("/api/health", (_req, res) => { res.json({ status: "ok", ts: new Date().toISOString() }) })

    app.post("/api/schedule", async (req, res) => {
      const { userId, scheduledTime, niche } = req.body
      const { data, error } = await supabase.from("schedules").insert([{ user_id: userId, scheduled_time: scheduledTime, niche, status: "pending" }])
      if (error) return res.status(500).json({ error: error.message })
      res.json(data)
    })

    app.get("/api/history/:userId", async (req, res) => {
      const { userId } = req.params
      const { data, error } = await supabase.from("posts").select("*").eq("user_id", userId).order("published_at", { ascending: false }).limit(8)
      if (error) return res.status(500).json({ error: error.message })
      res.json(data)
    })

    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa", root: process.cwd() })
      app.use(vite.middlewares)
    } else {
      const distPath = path.join(process.cwd(), "dist")
      app.use(express.static(distPath))
      app.get("*", (_req, res) => res.sendFile(path.join(distPath, "index.html")))
    }
    app.listen(PORT, "0.0.0.0", () => console.log(`Server running at http://0.0.0.0:${PORT}`))
  }
  startServer().catch(err => { console.error("Server startup failed:", err); process.exit(1) })
  