import { NextResponse } from "next/server"
import { ensureLinksTable, sql } from "@/lib/neon"

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