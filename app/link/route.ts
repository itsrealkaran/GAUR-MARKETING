import { NextResponse } from "next/server"
import { buildForwarderTarget, buildLinkCode, ensureLinksTable, findOrCreateLink, getVisitorId, setVisitorCookie, trackLinkVisit } from "@/lib/neon"

export async function GET(request: Request) {
  const url = new URL(request.url)
  const finalTargetUrl = buildForwarderTarget(url.toString())

  if (!finalTargetUrl) {
    return NextResponse.json({ error: "A valid url query parameter is required" }, { status: 400 })
  }
  const code = buildLinkCode(finalTargetUrl)

  await ensureLinksTable()
  await findOrCreateLink(finalTargetUrl, code)
  const visitor = getVisitorId(request.headers)
  const link = await trackLinkVisit(code, request.headers, visitor.id)

  const response = NextResponse.redirect(link?.target_url || finalTargetUrl)
  setVisitorCookie(response, visitor)
  return response
}
