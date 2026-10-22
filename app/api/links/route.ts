import { NextResponse } from "next/server"
import { buildLinkCode, ensureLinksTable, getLinkAnalytics, normalizeTargetUrl, sql } from "@/lib/neon"
import crypto from "crypto"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"))
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || "12")))
  const offset = (page - 1) * limit
  const search = url.searchParams.get("q")?.trim() || ""
  const searchPattern = `%${search}%`

  await ensureLinksTable()
  const rows = await sql`
    SELECT code, target_url, visits, created_at
    FROM links
    WHERE (${search === ""} OR code ILIKE ${searchPattern} OR target_url ILIKE ${searchPattern})
    ORDER BY created_at DESC
    LIMIT ${limit + 1} OFFSET ${offset}
  `

  const links = rows.slice(0, limit)
  const analytics = await getLinkAnalytics(links.map((row) => row.code))
  const analyticsByCode = new Map(analytics.map((row) => [row.code, row]))

  return NextResponse.json({
    links: links.map((link) => ({ ...link, analytics: analyticsByCode.get(link.code) || null })),
    hasMore: rows.length > limit,
    page,
    limit,
  })
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const targetUrl = typeof body.targetUrl === "string" ? body.targetUrl.trim() : ""
    const alias = typeof body.alias === "string" ? body.alias.trim().toLowerCase() : ""
    const normalizedTarget = normalizeTargetUrl(targetUrl)

    try {
      const parsedUrl = new URL(normalizedTarget)
      if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error()
    } catch {
      return NextResponse.json({ error: "A valid HTTP or HTTPS URL is required" }, { status: 400 })
    }

    if (alias && !/^[a-zA-Z0-9_-]+$/.test(alias)) {
      return NextResponse.json({ error: "Invalid alias" }, { status: 400 })
    }

    await ensureLinksTable()
    const code = alias || buildLinkCode(normalizedTarget) || crypto.randomBytes(6).toString("base64url")

    try {
      const result = await sql`
        INSERT INTO links (code, target_url)
        VALUES (${code}, ${normalizedTarget})
        ON CONFLICT (code) DO UPDATE SET target_url = EXCLUDED.target_url
        RETURNING code
      `

      return NextResponse.json({ code: result[0].code })
    } catch (error: unknown) {
      if (error instanceof Error && error.message.toLowerCase().includes("duplicate key")) {
        return NextResponse.json({ error: "That alias is already in use" }, { status: 409 })
      }
      throw error
    }
  } catch (error: unknown) {
    console.error("Failed to create tracked link:", error)
    return NextResponse.json({ error: "Unable to create link" }, { status: 500 })
  }
}