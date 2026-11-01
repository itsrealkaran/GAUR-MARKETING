import { after, NextResponse } from "next/server"
import {
  buildForwarderTarget,
  buildLinkCode,
  cacheLinkDestination,
  ensureLinksTable,
  findOrCreateLink,
  getVisitorId,
  recordLinkVisit,
  setVisitorCookie,
} from "@/lib/neon"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const finalTargetUrl = buildForwarderTarget(url.toString())

  if (!finalTargetUrl) {
    return NextResponse.json({ error: "A valid url query parameter is required" }, { status: 400 })
  }

  const code = buildLinkCode(finalTargetUrl)
  cacheLinkDestination(code, finalTargetUrl)
  const visitor = getVisitorId(request.headers)
  const headers = request.headers

  // Destination is already known from the query string — redirect immediately.
  after(async () => {
    try {
      await ensureLinksTable()
      await findOrCreateLink(finalTargetUrl, code)
      await recordLinkVisit(code, headers, visitor.id)
    } catch (error) {
      console.error("Failed to persist forwarder visit:", error)
    }
  })

  const response = NextResponse.redirect(finalTargetUrl)
  setVisitorCookie(response, visitor)
  return response
}
