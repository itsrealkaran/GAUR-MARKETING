import { NextResponse } from "next/server"
import { ensureLinksTable, getVisitorId, setVisitorCookie, trackLinkVisit } from "@/lib/neon"

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(code)) {
    return NextResponse.redirect(new URL("/?error=invalid_url", request.url))
  }

  try {
    await ensureLinksTable()
    const visitor = getVisitorId(request.headers)
    const link = await trackLinkVisit(code, request.headers, visitor.id)
    if (link?.target_url) {
      const response = NextResponse.redirect(link.target_url)
      setVisitorCookie(response, visitor)
      return response
    }
  } catch (error) {
    console.error("Failed to forward tracked link:", error)
  }

  return NextResponse.redirect(new URL("/?error=invalid_url", request.url))
}