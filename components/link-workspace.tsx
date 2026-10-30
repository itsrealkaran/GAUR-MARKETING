"use client"

import Link from "next/link"
import { ArrowLeft, ArrowUpRight, Copy, Link2, RefreshCw, Search, ScrollText } from "lucide-react"
import { FormEvent, ReactNode, useEffect, useRef, useState } from "react"

type Mode = "forwarder" | "redirect"
type LinkRecord = { code: string; target_url: string; visits: number; created_at?: string }
type LinkOverview = { totalLinks: number; totalVisits: number; topLinks: LinkRecord[] }
type LinkPage = { links: LinkRecord[]; hasMore: boolean; overview: LinkOverview }

export function LinkWorkspace() {
  const [mode, setMode] = useState<Mode>("forwarder")
  const [targetUrl, setTargetUrl] = useState("")
  const [alias, setAlias] = useState("")
  const [result, setResult] = useState<LinkRecord | null>(null)
  const [links, setLinks] = useState<LinkRecord[]>([])
  const [overview, setOverview] = useState<LinkOverview | null>(null)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const [origin, setOrigin] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searchInput, setSearchInput] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const sentinel = useRef<HTMLDivElement>(null)
  const loadingRef = useRef(false)
  const pageRef = useRef(0)
  const hasMoreRef = useRef(true)

  useEffect(() => {
    setOrigin(window.location.origin)
    loadLinks(1)
  }, [])

  useEffect(() => {
    const observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && pageRef.current > 0 && hasMoreRef.current && !loadingRef.current) {
        loadLinks(pageRef.current + 1)
      }
    }, { rootMargin: "240px" })
    if (sentinel.current) observer.observe(sentinel.current)
    return () => observer.disconnect()
  }, [hasMore, loadingMore, page])

  const loadLinks = async (nextPage: number, term = searchTerm) => {
    if (loadingRef.current) return
    loadingRef.current = true
    setLoadingMore(true)
    try {
      const response = await fetch(`/api/links?page=${nextPage}&limit=12&q=${encodeURIComponent(term)}`)
      if (!response.ok) return
      const data: LinkPage = await response.json()
      setOverview(data.overview)
      setLinks((current) => nextPage === 1 ? data.links : [...current, ...data.links])
      setPage(nextPage)
      setHasMore(data.hasMore)
      pageRef.current = nextPage
      hasMoreRef.current = data.hasMore
    } finally {
      loadingRef.current = false
      setLoadingMore(false)
    }
  }

  const submitSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextTerm = searchInput.trim()
    setSearchTerm(nextTerm)
    setHasMore(true)
    loadLinks(1, nextTerm)
  }

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      let destination = targetUrl.trim()
      if (!destination) throw new Error("Enter a destination URL")
      const response = await fetch("/api/links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetUrl: destination, alias: mode === "redirect" ? alias : "" }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Unable to create link")
      const created: LinkRecord = { code: data.code, target_url: data.target_url || destination, visits: Number(data.visits || 0) }
      setResult(created)
      await loadLinks(1)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create link")
    } finally {
      setBusy(false)
    }
  }

  const refresh = async () => {
    if (!result) return
    const response = await fetch(`/api/links/${encodeURIComponent(result.code)}`)
    if (response.ok) {
      const updated = await response.json()
      setResult(updated)
      setLinks((current) => current.map((link) => link.code === updated.code ? updated : link))
    }
  }

  const trackedUrl = result ? `${origin}/${encodeURIComponent(result.code)}` : ""
  const directUrl = result ? `${origin}/link?url=${encodeURIComponent(result.target_url)}` : ""
  const directUrlLabel = result ? `${origin}/link?url=${result.target_url}` : ""
  const copy = (value: string) => navigator.clipboard.writeText(value)

  return (
    <main className="min-h-screen bg-[#f4f1ea] text-[#202522]">
      <div className="mx-auto max-w-6xl px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between border-b border-[#202522]/15 pb-5">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={16} /> GAUR LINKS</Link>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#202522]/45">Link workspace</span>
        </header>

        <div className="grid gap-12 py-14 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-24">
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#bd5b32]">Build and measure</p>
            <h1 className="mt-4 max-w-2xl text-5xl font-semibold leading-none tracking-[-0.055em] sm:text-6xl">Every useful link, in one ledger.</h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#202522]/60">Forward a URL or create a code-based redirect. Each generated link is stored with its visit total.</p>

            <form onSubmit={create} className="mt-10 border border-[#202522]/15 bg-[#fbfaf6] p-5 sm:p-7">
              <div className="mb-7 grid grid-cols-2 border-b border-[#202522]/15">
                <ModeButton active={mode === "forwarder"} onClick={() => setMode("forwarder")} icon={<ArrowUpRight size={15} />} label="Forwarder" />
                <ModeButton active={mode === "redirect"} onClick={() => setMode("redirect")} icon={<Link2 size={15} />} label="Code redirect" />
              </div>
              <label className="block text-sm font-semibold">Destination URL<input required type="url" inputMode="url" autoComplete="url" placeholder="https://example.com/offer" value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} aria-describedby="url-help" className="mt-2 w-full border border-[#202522]/20 bg-transparent px-3 py-3 outline-none focus:border-[#bd5b32]" /><span id="url-help" className="mt-2 block text-xs font-normal text-[#202522]/50">The destination is normalized, so trailing-slash variants share one link and count.</span></label>
              {mode === "redirect" && <label className="mt-5 block text-sm font-semibold">Custom code <span className="font-normal text-[#202522]/45">optional</span><div className="mt-2 flex items-center border border-[#202522]/20"><span className="px-3 text-sm text-[#202522]/40">/</span><input pattern="[A-Za-z0-9_-]+" title="Use letters, numbers, underscores, or dashes" value={alias} onChange={(event) => setAlias(event.target.value)} placeholder="spring-offer" className="min-w-0 flex-1 bg-transparent px-1 py-3 outline-none" /></div><span className="mt-2 block text-xs font-normal text-[#202522]/50">Letters, numbers, underscores, and dashes only.</span></label>}
              {error && <p className="mt-4 text-sm text-[#bd5b32]">{error}</p>}
              <button disabled={busy} className="mt-6 inline-flex items-center gap-2 bg-[#202522] px-5 py-3 text-sm font-semibold text-[#f4f1ea] hover:bg-[#bd5b32] disabled:opacity-50">{busy ? "Creating..." : "Create tracked link"}<ArrowUpRight size={16} /></button>
            </form>
          </section>

          <aside className="border-l border-[#202522]/15 pl-0 lg:pl-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#202522]/45">Supported links</p>
            <dl className="mt-6 space-y-6 text-sm">
              <Info title="Forwarder" text="/link?url=... sends visitors to any HTTP or HTTPS destination." />
              <Info title="Code redirect" text="/your-code stores a destination and increments visits." />
            </dl>

            <section className="mt-8 border-t border-[#202522]/15 pt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#bd5b32]">Overview</p>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[#202522]/45">Total links</p>
                  <p className="mt-1 text-2xl font-semibold">{overview?.totalLinks.toLocaleString() ?? "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-[#202522]/45">Total clicks</p>
                  <p className="mt-1 text-2xl font-semibold">{overview?.totalVisits.toLocaleString() ?? "—"}</p>
                </div>
              </div>
              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.14em] text-[#202522]/45">Top codes</p>
              <div className="mt-2 divide-y divide-[#202522]/10">
                {overview?.topLinks.map((link) => (
                  <Link key={link.code} href={`/stats/${encodeURIComponent(link.code)}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-[#bd5b32]">
                    <span className="min-w-0 truncate font-medium">{link.code}</span>
                    <span className="shrink-0 tabular-nums text-[#202522]/55">{link.visits.toLocaleString()}</span>
                  </Link>
                ))}
                {overview && !overview.topLinks.length && <p className="py-2 text-sm text-[#202522]/45">No links yet</p>}
              </div>
            </section>
          </aside>
        </div>

        {result && <section className="border-t border-[#202522]/15 py-10"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#bd5b32]">Latest link</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">{result.visits.toLocaleString()} visits recorded</h2></div><button onClick={refresh} className="inline-flex items-center gap-2 text-sm font-semibold hover:text-[#bd5b32]"><RefreshCw size={15} /> Refresh count</button></div><div className="mt-7 grid gap-4 md:grid-cols-3"><Result label="Tracked URL" value={trackedUrl} onCopy={() => copy(trackedUrl)} /><Result label="Direct forwarder" value={directUrl} displayValue={directUrlLabel} onCopy={() => copy(directUrl)} /><div className="border border-[#202522]/15 bg-[#fbfaf6] p-5"><p className="text-xs uppercase tracking-[0.16em] text-[#202522]/45">Destination</p><p className="mt-4 break-all text-sm leading-6">{result.target_url}</p><p className="mt-4 text-xs uppercase tracking-[0.16em] text-[#202522]/45">Live visits are shown above</p></div></div></section>}

        <section className="border-t border-[#202522]/15 py-10"><div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#bd5b32]">Link ledger</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Recent links and visits</h2></div><button onClick={() => loadLinks(1)} className="inline-flex items-center gap-2 text-sm font-semibold hover:text-[#bd5b32]"><RefreshCw size={15} /> Refresh</button></div><form onSubmit={submitSearch} className="mt-6 flex max-w-2xl border border-[#202522]/20 bg-[#fbfaf6] focus-within:border-[#bd5b32]"><Search className="m-3 shrink-0 text-[#202522]/45" size={18} /><input value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Search by destination or link code" aria-label="Search links and visit counts" className="min-w-0 flex-1 bg-transparent py-3 pr-3 text-sm outline-none" /><button type="submit" className="border-l border-[#202522]/15 px-4 text-sm font-semibold hover:bg-[#202522] hover:text-[#f4f1ea]">Search</button></form>{searchTerm && <p className="mt-3 text-xs text-[#202522]/50">Showing results for “{searchTerm}”.</p>}<div className="mt-6 divide-y divide-[#202522]/15 border-y border-[#202522]/15">{links.map((link) => <LedgerRow key={link.code} link={link} origin={origin} />)}{!links.length && !loadingMore && <p className="py-8 text-sm text-[#202522]/55">No tracked links match this search.</p>}</div><div ref={sentinel} className="flex flex-col items-center gap-3 py-8 text-sm text-[#202522]/50">{loadingMore ? "Loading more links..." : hasMore ? <><span>Scroll for more</span><button type="button" onClick={() => loadLinks(pageRef.current + 1)} className="border border-[#202522]/20 px-4 py-2 font-semibold text-[#202522] hover:border-[#bd5b32]">Load more</button></> : "All matching links loaded"}</div></section>
      </div>
    </main>
  )
}

function ModeButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: ReactNode; label: string }) { return <button type="button" onClick={onClick} className={`flex items-center justify-center gap-2 border-b-2 pb-3 text-sm font-semibold ${active ? "border-[#bd5b32]" : "border-transparent text-[#202522]/45"}`}>{icon}{label}</button> }
function Info({ title, text }: { title: string; text: string }) { return <div><dt className="font-semibold">{title}</dt><dd className="mt-1 leading-6 text-[#202522]/55">{text}</dd></div> }
function Result({ label, value, displayValue = value, onCopy }: { label: string; value: string; displayValue?: string; onCopy: () => void }) { return <div className="border border-[#202522]/15 bg-[#fbfaf6] p-5"><p className="text-xs uppercase tracking-[0.16em] text-[#202522]/45">{label}</p><p className="mt-4 break-all text-sm leading-6">{displayValue}</p><button type="button" onClick={onCopy} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold hover:text-[#bd5b32]"><Copy size={14} /> Copy</button></div> }
function LedgerRow({ link, origin }: { link: LinkRecord; origin: string }) {
  const isForwarder = link.code.startsWith("link_")
  const trackedHref = isForwarder
    ? `${origin}/link?url=${encodeURIComponent(link.target_url)}`
    : `${origin}/${encodeURIComponent(link.code)}`
  const trackedLabel = isForwarder
    ? `${origin}/link?url=${link.target_url}`
    : `${origin}/${link.code}`
  const type = isForwarder ? "Forwarder" : "Code redirect"

  return (
    <div className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[#bd5b32]">
          <ScrollText size={14} /> {type}
        </div>
        <a href={link.target_url} target="_blank" rel="noopener noreferrer" title={link.target_url} className="mt-2 block truncate text-sm font-semibold hover:text-[#bd5b32]">{link.target_url}</a>
        <a href={trackedHref} target="_blank" rel="noopener noreferrer" title={trackedLabel} className="mt-1 block truncate text-sm text-[#202522]/50 hover:text-[#bd5b32]">{trackedLabel}</a>
      </div>
      <div className="shrink-0">
        <p className="text-xs uppercase tracking-[0.16em] text-[#202522]/45">Visits</p>
        <Link href={`/stats/${encodeURIComponent(link.code)}`} aria-label={`View analytics for ${link.code}`} className="mt-1 inline-flex text-2xl font-semibold hover:text-[#bd5b32] hover:underline">{link.visits.toLocaleString()}</Link>
      </div>
    </div>
  )
}
