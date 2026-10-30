import { NextResponse } from "next/server"
import { ensureLinksTable, getLinkReport } from "@/lib/neon"

const DAY_MS = 24 * 60 * 60 * 1000
const MAX_RANGE_DAYS = 92

function parseDate(value: string | null) {
  if (!value) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined
  const parsed = new Date(`${value}T00:00:00.000Z`)
  return parsed.toISOString().slice(0, 10) === value ? parsed : undefined
}

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params
  const url = new URL(request.url)
  const today = new Date()
  const todayStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const defaultFrom = new Date(todayStart.getTime() - 13 * DAY_MS)
  const requestedFrom = parseDate(url.searchParams.get("from"))
  const requestedTo = parseDate(url.searchParams.get("to"))

  if (requestedFrom === undefined || requestedTo === undefined) {
    return NextResponse.json({ error: "Dates must use YYYY-MM-DD format" }, { status: 400 })
  }

  const from = requestedFrom || defaultFrom
  const toStart = requestedTo || todayStart
  const to = new Date(toStart.getTime() + DAY_MS)
  if (from >= to) return NextResponse.json({ error: "Start date must be before end date" }, { status: 400 })
  if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * DAY_MS) {
    return NextResponse.json({ error: `Date range cannot exceed ${MAX_RANGE_DAYS} days` }, { status: 400 })
  }

  await ensureLinksTable()
  const report = await getLinkReport(code, from, to)
  if (!report) return NextResponse.json({ error: "Link not found" }, { status: 404 })

  return NextResponse.json({
    link: { code: report.code, target_url: report.target_url, visits: report.visits },
    clicks: Number(report.tracked_visits || 0),
    uniqueVisitors: Number(report.unique_visitors || 0),
    topCountry: report.countries?.[0]?.label || "",
    topReferrer: report.referrers?.[0]?.label || "",
    countries: report.countries || [],
    cities: report.cities || [],
    devices: report.devices || [],
    operatingSystems: report.operating_systems || [],
    browsers: report.browsers || [],
    languages: report.languages || [],
    referrers: report.referrers || [],
    days: report.days || [],
    activity: report.activity || [],
    from: from.toISOString().slice(0, 10),
    to: new Date(to.getTime() - DAY_MS).toISOString().slice(0, 10),
  })
}