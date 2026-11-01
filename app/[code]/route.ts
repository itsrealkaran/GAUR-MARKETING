import { after, NextResponse } from "next/server"
import { getLinkDestination, getVisitorId, recordLinkVisit, setVisitorCookie } from "@/lib/neon"

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  if (!/^[A-Za-z0-9_-]{1,100}$/.test(code)) {
    return NextResponse.redirect(new URL("/?error=invalid_url", request.url))
  }

  try {
    const visitor = getVisitorId(request.headers)
    const link = await getLinkDestination(code)
    if (link?.target_url) {
      const headers = request.headers
      after(async () => {
        try {
          await recordLinkVisit(link.code, headers, visitor.id)
        } catch (error) {
          console.error("Failed to record link visit:", error)
        }
      })
      const response = NextResponse.redirect(link.target_url)
      setVisitorCookie(response, visitor)
      return response
    }
  } catch (error) {
    console.error("Failed to forward tracked link:", error)
  }

  return NextResponse.redirect(new URL("/?error=invalid_url", request.url))
}
