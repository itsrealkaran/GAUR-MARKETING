"use client"

import Link from "next/link"
import { ArrowLeft, ArrowUpRight, Copy, ExternalLink, RefreshCw } from "lucide-react"
import { FormEvent, useEffect, useState } from "react"

interface LinkRecord { code: string; target_url: string; visits: number }

export function LinkBuilder() {
  const [targetUrl, setTargetUrl] = useState("")
  const [alias, setAlias] = useState("")
  const [result, setResult] = useState<LinkRecord | null>(null)
  const [origin, setOrigin] = useState("")
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)

  useEffect(() => setOrigin(window.location.origin), [])

  const create = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setBusy(true)
    setError("")
    try {
      const response = await fetch("/api/links", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetUrl, alias }) })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || "Unable to create link")
      setResult({ code: data.code, target_url: data.target_url || targetUrl, visits: Number(data.visits || 0) })
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to create link")
    } finally {
      setBusy(false)
    }
  }

  const refresh = async () => {
    if (!result) return
    const response = await fetch(`/api/links/${encodeURIComponent(result.code)}`)
    if (response.ok) setResult(await response.json())
  }

  const trackedUrl = result ? `${origin}/${encodeURIComponent(result.code)}` : ""
  const directUrl = result ? `${origin}/link?url=${encodeURIComponent(targetUrl)}` : ""
  const directUrlLabel = result ? `${origin}/link?url=${targetUrl}` : ""
  const copy = (value: string) => navigator.clipboard.writeText(value)

  return (
    <main className="min-h-screen bg-[#f4f1ea] text-[#202522]">
      <div className="mx-auto min-h-screen max-w-5xl px-5 py-6 sm:px-8">
        <header className="flex items-center justify-between border-b border-[#202522]/15 pb-5">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold"><ArrowLeft size={16} /> GAUR LINKS</Link>
          <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#202522]/45">Link builder</span>
        </header>

        <div className="grid gap-12 py-14 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-24">
          <section>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#bd5b32]">Create a tracked link</p>
            <h1 className="mt-4 max-w-2xl text-5xl font-semibold leading-none tracking-[-0.055em] sm:text-6xl">One destination. A clearer signal.</h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-[#202522]/60">Enter a destination and get a redirect URL with a visit counter. Add an alias when you want a memorable path.</p>

            <form onSubmit={create} className="mt-10 border border-[#202522]/15 bg-[#fbfaf6] p-5 sm:p-7">
              <label className="block text-sm font-semibold">Destination URL<input required type="url" placeholder="https://example.com/offer" value={targetUrl} onChange={(event) => setTargetUrl(event.target.value)} className="mt-2 w-full border border-[#202522]/20 bg-transparent px-3 py-3 outline-none focus:border-[#bd5b32]" /></label>
              <label className="mt-5 block text-sm font-semibold">Custom alias <span className="font-normal text-[#202522]/45">optional</span><div className="mt-2 flex items-center border border-[#202522]/20"><span className="px-3 text-sm text-[#202522]/40">/</span><input value={alias} onChange={(event) => setAlias(event.target.value)} placeholder="spring-offer" className="min-w-0 flex-1 bg-transparent px-1 py-3 outline-none" /></div></label>
              {error && <p className="mt-4 text-sm text-[#bd5b32]">{error}</p>}
              <button disabled={busy} className="mt-6 inline-flex items-center gap-2 bg-[#202522] px-5 py-3 text-sm font-semibold text-[#f4f1ea] hover:bg-[#bd5b32] disabled:opacity-50">{busy ? "Creating..." : "Create tracked link"}<ArrowUpRight size={16} /></button>
            </form>
          </section>

          <aside className="border-l border-[#202522]/15 pl-0 lg:pl-8">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#202522]/45">What gets tracked</p>
            <dl className="mt-6 space-y-6 text-sm">
              <Info title="Alias links" text="/your-alias links created here." />
              <Info title="Direct forwarders" text="/link?url=... requests are counted too." />
              <Info title="Visit totals" text="Every redirect increments its Neon row." />
            </dl>
          </aside>
        </div>

        {result && <section className="border-t border-[#202522]/15 py-10">
          <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#bd5b32]">Created</p><h2 className="mt-2 text-3xl font-semibold tracking-tight">Your link is live</h2></div><button onClick={refresh} className="inline-flex items-center gap-2 text-sm font-semibold hover:text-[#bd5b32]"><RefreshCw size={15} /> Refresh count</button></div>
          <div className="mt-7 grid gap-4 md:grid-cols-3">
            <Result label="Tracked URL" value={trackedUrl} onCopy={() => copy(trackedUrl)} />
            <Result label="Direct forwarder" value={directUrl} displayValue={directUrlLabel} onCopy={() => copy(directUrl)} />
            <div className="border border-[#202522]/15 bg-[#fbfaf6] p-5"><p className="text-xs uppercase tracking-[0.16em] text-[#202522]/45">Total visits</p><p className="mt-4 text-5xl font-semibold tracking-tight">{result.visits.toLocaleString()}</p><Link href={`/stats/${encodeURIComponent(result.code)}`} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold underline underline-offset-4">View stats <ExternalLink size={14} /></Link></div>
          </div>
        </section>}
      </div>
    </main>
  )
}

function Info({ title, text }: { title: string; text: string }) { return <div><dt className="font-semibold">{title}</dt><dd className="mt-1 leading-6 text-[#202522]/55">{text}</dd></div> }
function Result({ label, value, displayValue = value, onCopy }: { label: string; value: string; displayValue?: string; onCopy: () => void }) { return <div className="border border-[#202522]/15 bg-[#fbfaf6] p-5"><p className="text-xs uppercase tracking-[0.16em] text-[#202522]/45">{label}</p><p className="mt-4 break-all text-sm leading-6">{displayValue}</p><button onClick={onCopy} className="mt-4 inline-flex items-center gap-2 text-sm font-semibold hover:text-[#bd5b32]"><Copy size={14} /> Copy</button></div> }
