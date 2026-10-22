import { NextResponse } from "next/server"
import { findOrCreateLink, getVisitorId, setVisitorCookie, trackLinkVisit } from "@/lib/neon"

export async function GET(request: Request, { params }: { params: Promise<{ phone: string }> }) {
  const { phone } = await params
  if (!/^\d{7,15}$/.test(phone)) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 })
  }

  const incomingUrl = new URL(request.url)
  const message = incomingUrl.searchParams.get("text")
  const target = new URL(`https://wa.me/${phone}`)
  if (message) target.searchParams.set("text", message)

  const link = await findOrCreateLink(target.toString())
  const visitor = getVisitorId(request.headers)
  await trackLinkVisit(link.code, request.headers, visitor.id)

  const response = NextResponse.redirect(target)
  setVisitorCookie(response, visitor)
  return response
}