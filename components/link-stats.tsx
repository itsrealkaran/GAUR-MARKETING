"use client"

import Link from "next/link"
import { useEffect, useState, type FormEvent } from "react"
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts"
import { ArrowLeft, ArrowUpRight, RefreshCw } from "lucide-react"

type Breakdown = { label: string; count: number }
type Activity = {
  country: string
  city: string
  device: string
  operating_system: string
  browser: string
  language: string
  referrer: string
  created_at: string
}
type Stats = {
  link: { code: string; target_url: string; visits: number }
  clicks: number
  uniqueVisitors: number
  topCountry: string
  topReferrer: string
  countries: Breakdown[]
  cities: Breakdown[]
  devices: Breakdown[]
  operatingSystems: Breakdown[]
  browsers: Breakdown[]
  languages: Breakdown[]
  referrers: Breakdown[]
  days: { day: string; clicks: number }[]
  activity: Activity[]
}

const tabs = [
  { id: "summary", label: "Summary" },
  { id: "locations", label: "Locations" },
  { id: "platforms", label: "Platforms" },
  { id: "browsers", label: "Browsers" },
  { id: "languages", label: "Languages" },
  { id: "referrers", label: "Referrers" },
] as const

type Tab = (typeof tabs)[number]["id"]

function dateInput(date: Date) {
  return date.toISOString().slice(0, 10)
}

function initialRange() {
  const today = new Date()
  const from = new Date(today)
  from.setDate(from.getDate() - 13)
  return { from: dateInput(from), to: dateInput(today) }
}

export function LinkStats({ code }: { code: string }) {
  const [range, setRange] = useState(initialRange)
  const [draft, setDraft] = useState(range)
  const [stats, setStats] = useState<Stats | null>(null)
  const [origin, setOrigin] = useState("")
  const [tab, setTab] = useState<Tab>("summary")
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  useEffect(() => {
    const controller = new AbortController()
    async function load() {
      setLoading(true)
      setError("")
      try {
        const response = await fetch(`/api/links/${encodeURIComponent(code)}/stats?from=${range.from}&to=${range.to}`, {
          cache: "no-store",
          signal: controller.signal,
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error || "Unable to load link analytics")
        setStats(data)
      } catch (caught) {
        if (caught instanceof Error && caught.name === "AbortError") return
        setError(caught instanceof Error ? caught.message : "Unable to load link analytics")
      } finally {
        if (!controller.signal.aborted) setLoading(false)
      }
    }
    load()
    return () => controller.abort()
  }, [code, range])

  useEffect(() => setOrigin(window.location.origin), [])

  const applyRange = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setRange(draft)
  }

  const breakdowns = stats ? getBreakdowns(tab, stats) : []
  const trackedUrl = stats
    ? stats.link.code.startsWith("link_")
      ? `${origin}/link?url=${encodeURIComponent(stats.link.target_url)}`
      : `${origin}/${stats.link.code}`
    : ""
  const trackedLabel = stats
    ? stats.link.code.startsWith("link_")
      ? `${origin}/link?url=${stats.link.target_url}`
      : `${origin}/${stats.link.code}`
    : ""

  return (
    <main className="min-h-screen bg-[#f4f1ea] text-[#202522]">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between border-b border-[#202522]/15 pb-5">
          <Link href="/generate" className="inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={16} /> Link workspace</Link>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#202522]/45">Visitor analytics</span>
        </header>

        <section className="border-b border-[#202522]/15 py-8">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#bd5b32]">Link breakdown</p>
          {stats ? <a href={stats.link.target_url} target="_blank" rel="noopener noreferrer" className="mt-3 block break-all text-2xl font-semibold hover:text-[#bd5b32] sm:text-3xl">{stats.link.target_url}<ArrowUpRight size={16} className="ml-2 inline" /></a> : <h1 className="mt-3 break-all text-3xl font-semibold sm:text-4xl">{code}</h1>}
          {stats && <a href={trackedUrl} target="_blank" rel="noopener noreferrer" className="mt-2 block break-all text-xs text-[#202522]/45 hover:text-[#bd5b32]">{trackedLabel}</a>}
        </section>

        {error && <p role="alert" className="mt-6 border-l-2 border-[#bd5b32] py-2 pl-3 text-sm">{error}</p>}

        <section className="border-b border-[#202522]/15 py-7">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#bd5b32]">Performance</p>
              <h2 className="mt-2 text-2xl font-semibold">{loading && !stats ? "Loading analytics..." : "Visit activity"}</h2>
            </div>
            <form onSubmit={applyRange} className="flex flex-wrap items-end gap-3">
              <label className="grid gap-1 text-xs font-semibold text-[#202522]/60">From<input type="date" required value={draft.from} onChange={(event) => setDraft((current) => ({ ...current, from: event.target.value }))} className="h-10 border border-[#202522]/20 bg-[#fbfaf6] px-3 text-sm text-[#202522]" /></label>
              <label className="grid gap-1 text-xs font-semibold text-[#202522]/60">To<input type="date" required value={draft.to} onChange={(event) => setDraft((current) => ({ ...current, to: event.target.value }))} className="h-10 border border-[#202522]/20 bg-[#fbfaf6] px-3 text-sm text-[#202522]" /></label>
              <button className="h-10 bg-[#202522] px-4 text-sm font-semibold text-[#f4f1ea] hover:bg-[#bd5b32]">Apply</button>
            </form>
          </div>
        </section>

        {stats && <>
          <section className="grid grid-cols-2 border-b border-[#202522]/15 sm:grid-cols-3 lg:grid-cols-5">
            <Metric label="Clicks in range" value={stats.clicks} />
            <Metric label="Unique visitors" value={stats.uniqueVisitors} />
            <Metric label="All-time visits" value={stats.link.visits} />
            <Metric label="Top country" value={stats.topCountry || "No data"} />
            <Metric label="Top referrer" value={stats.topReferrer || "No data"} />
          </section>

          <section className="border-b border-[#202522]/15 py-7">
            <div className="flex min-w-0 overflow-x-auto border-b border-[#202522]/15">
              {tabs.map((item) => <button key={item.id} type="button" onClick={() => setTab(item.id)} className={`shrink-0 border-b-2 px-4 py-3 text-sm font-semibold ${tab === item.id ? "border-[#bd5b32] text-[#202522]" : "border-transparent text-[#202522]/45 hover:text-[#202522]"}`}>{item.label}</button>)}
            </div>

            {tab === "summary" ? <div className="pt-6">
              <div className="h-64 w-full" role="img" aria-label="Daily link clicks chart">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={stats.days} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                    <defs><linearGradient id="clickFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#bd5b32" stopOpacity={0.24} /><stop offset="95%" stopColor="#bd5b32" stopOpacity={0.02} /></linearGradient></defs>
                    <CartesianGrid vertical={false} stroke="#20252220" strokeDasharray="3 4" />
                    <XAxis dataKey="day" tickFormatter={(value: string) => value.slice(5)} tickLine={false} axisLine={false} minTickGap={28} tick={{ fill: "#20252280", fontSize: 11 }} />
                    <YAxis allowDecimals={false} width={34} tickLine={false} axisLine={false} tick={{ fill: "#20252280", fontSize: 11 }} />
                    <Tooltip labelFormatter={(value) => String(value)} contentStyle={{ border: "1px solid #20252225", background: "#fbfaf6", borderRadius: 2, fontSize: 12 }} />
                    <Area type="monotone" dataKey="clicks" name="Clicks" stroke="#bd5b32" strokeWidth={2} fill="url(#clickFill)" activeDot={{ r: 4, fill: "#bd5b32" }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-2 text-xs text-[#202522]/45">All-time visits: {stats.link.visits.toLocaleString()}. The chart and visitor breakdown use the selected date range.</p>
            </div> : <div className="grid gap-x-10 gap-y-7 py-6 sm:grid-cols-2 lg:grid-cols-3">
              {breakdowns.map((group) => <BreakdownList key={group.label} group={group} />)}
              {!breakdowns.length && <p className="text-sm text-[#202522]/50">No visitor details recorded in this date range.</p>}
            </div>}
          </section>

          <section className="py-8">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#bd5b32]">Latest events</p><h2 className="mt-2 text-2xl font-semibold">Recent activity</h2></div>
              <span className="text-xs text-[#202522]/45">Up to 50 visits in this date range</span>
            </div>
            <div className="mt-5 divide-y divide-[#202522]/15 border-y border-[#202522]/15">
              {stats.activity.map((visit, index) => <ActivityRow key={`${visit.created_at}-${index}`} visit={visit} />)}
              {!stats.activity.length && <p className="py-8 text-sm text-[#202522]/50">No visits in this date range.</p>}
            </div>
          </section>
        </>}
      </div>
    </main>
  )
}

function getBreakdowns(tab: Tab, stats: Stats) {
  if (tab === "locations") return [{ label: "Countries", items: stats.countries }, { label: "Cities / regions", items: stats.cities }].filter((group) => group.items.length)
  if (tab === "platforms") return [{ label: "Devices", items: stats.devices }, { label: "Operating systems", items: stats.operatingSystems }].filter((group) => group.items.length)
  if (tab === "browsers") return [{ label: "Browsers", items: stats.browsers }].filter((group) => group.items.length)
  if (tab === "languages") return [{ label: "Languages", items: stats.languages }].filter((group) => group.items.length)
  if (tab === "referrers") return [{ label: "Referrers", items: stats.referrers }].filter((group) => group.items.length)
  return []
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="border-b border-r border-[#202522]/15 px-4 py-5 last:border-r-0"><p className="text-xs font-semibold uppercase tracking-[0.12em] text-[#202522]/45">{label}</p><p className="mt-2 truncate text-xl font-semibold sm:text-2xl">{typeof value === "number" ? value.toLocaleString() : value}</p></div>
}

function BreakdownList({ group }: { group: { label: string; items: Breakdown[] } }) {
  const peak = Math.max(1, ...group.items.map((item) => item.count))
  return <div><h3 className="mb-3 text-sm font-semibold">{group.label}</h3><div className="space-y-3">{group.items.map((item) => <div key={item.label}><div className="flex items-center justify-between gap-3 text-xs"><span className="truncate">{item.label}</span><span className="shrink-0 tabular-nums text-[#202522]/55">{item.count.toLocaleString()}</span></div><div className="mt-1 h-1.5 bg-[#202522]/8"><div className="h-full bg-[#bd5b32]" style={{ width: `${Math.max(2, item.count / peak * 100)}%` }} /></div></div>)}</div></div>
}

function ActivityRow({ visit }: { visit: Activity }) {
  const location = [visit.city, visit.country].filter(Boolean).join(", ") || "Unknown location"
  const details = [visit.device, visit.operating_system, visit.browser, visit.language].filter(Boolean).join(" · ")
  return <article className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center"><div className="min-w-0"><p className="truncate text-sm font-semibold">{location}</p><p className="mt-1 truncate text-xs text-[#202522]/55">{details || "Unknown device"}{visit.referrer ? ` · ${visit.referrer}` : ""}</p></div><time className="text-xs tabular-nums text-[#202522]/45" dateTime={visit.created_at}>{new Date(visit.created_at).toLocaleString()}</time></article>
}