import { NextResponse } from "next/server"
import { ensureLinksTable, getLinkAnalytics, sql } from "@/lib/neon"

export async function GET(_request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  await ensureLinksTable()
  const rows = await sql`
    SELECT code, target_url, visits
    FROM links
    WHERE code = ${code}
  `

  if (!rows[0]) return NextResponse.json({ error: "Link not found" }, { status: 404 })
  const analytics = await getLinkAnalytics([code])
  return NextResponse.json({ ...rows[0], analytics: analytics[0] || null })
}