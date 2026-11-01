import { NextResponse } from "next/server"
import { ensureLinksTable, normalizeTargetUrl, sql } from "@/lib/neon"

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  await ensureLinksTable()
  const rows = await sql`
    SELECT code, target_url, visits
    FROM links
    WHERE code = ${code}
  `

  if (!rows[0]) return NextResponse.json({ error: "Link not found" }, { status: 404 })
  return NextResponse.json(rows[0])
}

export async function PATCH(request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params
    const body = await request.json()
    const targetUrl = typeof body.targetUrl === "string" ? body.targetUrl.trim() : ""
    const normalizedTarget = normalizeTargetUrl(targetUrl)

    try {
      const parsedUrl = new URL(normalizedTarget)
      if (!["http:", "https:"].includes(parsedUrl.protocol)) throw new Error()
    } catch {
      return NextResponse.json({ error: "A valid HTTP or HTTPS URL is required" }, { status: 400 })
    }

    await ensureLinksTable()
    const rows = await sql`
      UPDATE links
      SET target_url = ${normalizedTarget}
      WHERE code = ${code}
      RETURNING code, target_url, visits
    `

    if (!rows[0]) return NextResponse.json({ error: "Link not found" }, { status: 404 })
    cacheLinkDestination(String(rows[0].code), String(rows[0].target_url))
    return NextResponse.json(rows[0])
  } catch (error) {
    console.error("Failed to update tracked link:", error)
    return NextResponse.json({ error: "Unable to update link" }, { status: 500 })
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  try {
    const { code } = await params
    await ensureLinksTable()
    const rows = await sql`
      DELETE FROM links
      WHERE code = ${code}
      RETURNING code
    `

    if (!rows[0]) return NextResponse.json({ error: "Link not found" }, { status: 404 })
    forgetLinkDestination(code)
    return NextResponse.json({ deleted: true, code: rows[0].code })
  } catch (error) {
    console.error("Failed to delete tracked link:", error)
    return NextResponse.json({ error: "Unable to delete link" }, { status: 500 })
  }
}