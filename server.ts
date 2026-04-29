import express from "express"
import { createServer as createViteServer } from "vite"
import path from "path"
import { fileURLToPath } from "url"
import dotenv from "dotenv"
import axios from "axios"
import cookieParser from "cookie-parser"
import { createClient } from "@supabase/supabase-js"

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

async function startServer() {
  const app = express()
  const PORT = 3000

  app.use(express.json())
  app.use(cookieParser())

  // Supabase Setup
  const supabaseUrl = process.env.SUPABASE_URL || "https://aprwenafjyruidxmafkx.supabase.co"
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || "dummy-key"
  
  if (!supabaseUrl || supabaseUrl === "undefined") {
    console.warn("WARNING: SUPABASE_URL is not set.")
  }
  
  const supabase = createClient(supabaseUrl, supabaseKey)

  // TikTok Config
  const TIKTOK_CLIENT_KEY = process.env.TIKTOK_CLIENT_KEY
  const TIKTOK_CLIENT_SECRET = process.env.TIKTOK_CLIENT_SECRET
  const REDIRECT_URI = `${process.env.APP_URL}/auth/callback`

  console.log("Initializing API routes...")

  // API Routes
  app.get("/api/auth/tiktok/url", (req, res) => {
    const scope = "user.info.basic,video.publish,video.upload"
    const state = Math.random().toString(36).substring(7)
    
    const authUrl = `https://www.tiktok.com/v2/auth/authorize/?client_key=${TIKTOK_CLIENT_KEY}&scope=${scope}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&state=${state}`
    
    res.json({ url: authUrl })
  })

  // ... (rest of auth callback logic)
  app.get("/auth/callback", async (req, res) => {
    const { code } = req.query
    if (!code) return res.status(400).send("No code provided")

    try {
      const response = await axios.post("https://open.tiktokapis.com/v2/oauth/token/", 
        new URLSearchParams({
          client_key: TIKTOK_CLIENT_KEY!,
          client_secret: TIKTOK_CLIENT_SECRET!,
          code: code as string,
          grant_type: "authorization_code",
          redirect_uri: REDIRECT_URI
        }), {
          headers: { "Content-Type": "application/x-www-form-urlencoded" }
        }
      )

      const { access_token, refresh_token, expires_in, open_id } = response.data
      const userResponse = await axios.get("https://open.tiktokapis.com/v2/user/info/?fields=open_id,union_id,avatar_url,display_name", {
        headers: { Authorization: `Bearer ${access_token}` }
      })

      const userData = userResponse.data.data.user
      
      await supabase.from("profiles").upsert({
        id: open_id,
        username: userData.display_name,
        avatar_url: userData.avatar_url,
        access_token,
        refresh_token,
        expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
        updated_at: new Date().toISOString()
      })

      res.send(`<html><body><script>if (window.opener) { window.opener.postMessage({ type: 'OAUTH_AUTH_SUCCESS', user_id: '${open_id}' }, '*'); window.close(); } else { window.location.href = '/dashboard'; }</script></body></html>`)
    } catch (error: any) {
      res.status(500).send("Authentication failed")
    }
  })

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

  // Vite middleware
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting Vite in development mode...")
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
      root: process.cwd(),
    })
    app.use(vite.middlewares)
  } else {
    console.log("Starting in production mode...")
    const distPath = path.join(process.cwd(), "dist")
    app.use(express.static(distPath))
    app.get("*", (req, res) => res.sendFile(path.join(distPath, "index.html")))
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> Server is live at http://0.0.0.0:${PORT}`)
  })
}

startServer().catch(err => {
  console.error("Critical server failure:", err)
  process.exit(1)
})
