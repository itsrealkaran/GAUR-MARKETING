import { NextResponse } from "next/server"
import { buildLinkCode, ensureLinksTable, normalizeTargetUrl, sql } from "@/lib/neon"
import crypto from "crypto"

const reservedRootCodes = new Set(["about", "admin", "api", "contact", "generate", "link", "r", "services", "stats"])

export async function GET(request: Request) {
  const url = new URL(request.url)
  const page = Math.max(1, Number(url.searchParams.get("page") || "1"))
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") || "12")))
  const offset = (page - 1) * limit
  const search = url.searchParams.get("q")?.trim() || ""
  const searchPattern = `%${search}%`

  await ensureLinksTable()
  const rows = await sql`
    WITH page_rows AS (
      SELECT code, target_url, visits, created_at,
        ROW_NUMBER() OVER (ORDER BY created_at DESC) AS row_number
      FROM links
      WHERE (${search === ""} OR code ILIKE ${searchPattern} OR target_url ILIKE ${searchPattern})
      ORDER BY created_at DESC
      LIMIT ${limit + 1} OFFSET ${offset}
    ), totals AS (
      SELECT COUNT(*)::int AS total_links, COALESCE(SUM(visits), 0)::bigint AS total_visits
      FROM links
    ), top_links AS (
      SELECT COALESCE(json_agg(json_build_object(
        'code', code,
        'target_url', target_url,
        'visits', visits
      ) ORDER BY visits DESC, created_at DESC), '[]'::json) AS links
      FROM (
        SELECT code, target_url, visits, created_at
        FROM links
        ORDER BY visits DESC, created_at DESC
        LIMIT 5
      ) AS ranked_links
    )
    SELECT
      COALESCE(json_agg(json_build_object(
        'code', code,
        'target_url', target_url,
        'visits', visits,
        'created_at', created_at
      ) ORDER BY row_number) FILTER (WHERE row_number <= ${offset + limit}), '[]'::json) AS links,
      COALESCE(MAX(row_number) > ${offset + limit}, false) AS has_more,
      (SELECT total_links FROM totals) AS total_links,
      (SELECT total_visits FROM totals) AS total_visits,
      (SELECT links FROM top_links) AS top_links
    FROM page_rows
  `

  const overview = {
    totalLinks: Number(rows[0]?.total_links || 0),
    totalVisits: Number(rows[0]?.total_visits || 0),
    topLinks: rows[0]?.top_links || [],
  }

  return NextResponse.json({
    links: rows[0]?.links || [],
    hasMore: rows[0]?.has_more || false,
    page,
    limit,
    overview,
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
    if (reservedRootCodes.has(alias)) {
      return NextResponse.json({ error: "That code is reserved by the site" }, { status: 409 })
    }

    await ensureLinksTable()
    const code = alias || buildLinkCode(normalizedTarget) || crypto.randomBytes(6).toString("base64url")

    try {
      const result = await sql`
        INSERT INTO links (code, target_url)
        VALUES (${code}, ${normalizedTarget})
        ON CONFLICT (code) DO UPDATE SET target_url = EXCLUDED.target_url
        RETURNING code, target_url, visits
      `

      return NextResponse.json(result[0])
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