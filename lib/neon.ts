import crypto from "crypto"
import { isIP } from "node:net"
import { neon } from "@neondatabase/serverless"

const databaseUrl = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL

export const sql = neon(databaseUrl || "")
let linksSchemaPromise: Promise<void> | null = null

export function normalizeTargetUrl(rawUrl: string) {
  const trimmed = rawUrl.trim()
  if (!trimmed) return ""
  const hasHttpProtocol = /^https?:\/\//i.test(trimmed)
  const hasExplicitProtocol = /^[a-z][a-z\d+.-]*:/i.test(trimmed)
  const isHostWithPort = /^[^/:?#]+:\d+(?:[/?#]|$)/.test(trimmed)
  if (hasExplicitProtocol && !hasHttpProtocol && !isHostWithPort) return ""
  const candidate = hasHttpProtocol ? trimmed : trimmed.startsWith("//") ? `https:${trimmed}` : `https://${trimmed}`

  try {
    const parsed = new URL(candidate)
    if (parsed.pathname.length > 1) parsed.pathname = parsed.pathname.replace(/\/+$/, "")
    return parsed.toString()
  } catch {
    return candidate
  }
}

export function buildLinkCode(targetUrl: string, alias?: string) {
  const normalized = normalizeTargetUrl(targetUrl)
  if (alias) return alias
  return `link_${crypto.createHash("sha256").update(normalized).digest("base64url").replace(/=+$/g, "").slice(0, 16)}`
}

export function buildForwarderTarget(requestUrl: string) {
  const request = new URL(requestUrl)
  const targetParam = request.searchParams.get("url")
  if (!targetParam) return ""

  let destination: URL
  try {
    destination = new URL(normalizeTargetUrl(targetParam))
  } catch {
    return ""
  }

  for (const [key, value] of request.searchParams.entries()) {
    if (key !== "url") destination.searchParams.append(key, value)
  }

  return normalizeTargetUrl(destination.toString())
}

export async function ensureLinksTable() {
  if (!databaseUrl) {
    throw new Error("DATABASE_URL_POOLED or DATABASE_URL is not configured")
  }

  if (!linksSchemaPromise) {
    linksSchemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS links (
          code TEXT PRIMARY KEY,
          target_url TEXT NOT NULL,
          visits INTEGER NOT NULL DEFAULT 0,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `

      await sql`
        CREATE TABLE IF NOT EXISTS link_visit_events (
          id BIGSERIAL PRIMARY KEY,
          code TEXT NOT NULL REFERENCES links(code) ON DELETE CASCADE,
          visitor_id TEXT NOT NULL,
          country TEXT NOT NULL DEFAULT '',
          city TEXT NOT NULL DEFAULT '',
          device TEXT NOT NULL DEFAULT '',
          operating_system TEXT NOT NULL DEFAULT '',
          browser TEXT NOT NULL DEFAULT '',
          language TEXT NOT NULL DEFAULT '',
          referrer TEXT NOT NULL DEFAULT '',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `

      await sql`CREATE INDEX IF NOT EXISTS link_visit_events_code_created_idx ON link_visit_events (code, created_at DESC)`
    })().catch((error) => {
      linksSchemaPromise = null
      throw error
    })
  }

  await linksSchemaPromise
}

export async function findOrCreateLink(targetUrl: string, alias?: string) {
  const normalizedUrl = normalizeTargetUrl(targetUrl)
  const code = buildLinkCode(normalizedUrl, alias)

  await ensureLinksTable()
  const rows = (await sql`
    INSERT INTO links (code, target_url)
    VALUES (${code}, ${normalizedUrl})
    ON CONFLICT (code) DO UPDATE SET target_url = EXCLUDED.target_url
    RETURNING code, target_url, visits
  `) as Array<{ code: string; target_url: string; visits: number }>

  return rows[0]
}

export function getVisitorId(headers: Headers) {
  const cookie = headers.get("cookie") || ""
  const match = cookie.match(/(?:^|;\s*)gaur_visitor=([a-f\d-]{36})(?:;|$)/i)
  const existing = match?.[1]
  if (existing && /^[a-f\d]{8}(?:-[a-f\d]{4}){3}-[a-f\d]{12}$/i.test(existing)) {
    return { id: existing, isNew: false }
  }
  return { id: crypto.randomUUID(), isNew: true }
}

export function setVisitorCookie(response: Response, visitor: { id: string; isNew: boolean }) {
  if (!visitor.isNew || !(response instanceof Response)) return
  const headers = new Headers(response.headers)
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : ""
  headers.append("Set-Cookie", `gaur_visitor=${visitor.id}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${secure}`)
  response.headers.set("Set-Cookie", headers.get("Set-Cookie") || "")
}

function headerValue(headers: Headers, names: string[]) {
  for (const name of names) {
    const value = headers.get(name)?.trim()
    if (!value) continue

    try {
      const decoded = decodeURIComponent(value).trim()
      if (decoded && decoded.length <= 100) return decoded.replace(/[\u0000-\u001f\u007f]/g, "")
    } catch {
      if (value.length <= 100) return value.replace(/[\u0000-\u001f\u007f]/g, "")
    }
  }
  return ""
}

function countryName(code: string) {
  const normalized = code.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(normalized) || normalized === "XX" || normalized === "T1") return ""
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(normalized) || normalized
  } catch {
    return normalized
  }
}

function deviceFromAgent(agent: string) {
  if (/iPad|Tablet|PlayBook|Silk/i.test(agent)) return "Tablet"
  if (/Mobile|iPhone|Android/i.test(agent)) return "Mobile"
  return agent ? "Desktop" : "Unknown"
}

function operatingSystemFromAgent(agent: string) {
  if (/iPhone|iPad|iPod/i.test(agent)) return "iOS"
  if (/Android/i.test(agent)) return "Android"
  if (/Windows/i.test(agent)) return "Windows"
  if (/Mac OS|Macintosh/i.test(agent)) return "macOS"
  if (/Linux/i.test(agent)) return "Linux"
  return agent ? "Other" : "Unknown"
}

function browserFromAgent(agent: string) {
  if (/Edg\//i.test(agent)) return "Edge"
  if (/OPR\/|Opera/i.test(agent)) return "Opera"
  if (/Firefox\//i.test(agent)) return "Firefox"
  if (/Chrome\//i.test(agent)) return "Chrome"
  if (/Safari\//i.test(agent)) return "Safari"
  return agent ? "Other" : "Unknown"
}

function languageFromHeader(value: string) {
  const tag = value.split(",")[0]?.trim().split(";")[0] || ""
  const language = tag.split("-")[0]?.toLowerCase()
  if (!language) return "Unknown"
  try {
    return new Intl.DisplayNames(["en"], { type: "language" }).of(language) || language
  } catch {
    return language
  }
}

function referrerFromHeader(value: string) {
  if (!value) return "Direct"
  try {
    return new URL(value).hostname.replace(/^www\./i, "").slice(0, 120) || "Direct"
  } catch {
    return "Direct"
  }
}

type VisitorPlace = { country: string; city: string; region: string }
type CachedPlace = { value: VisitorPlace | null; expiresAt: number }

const placeCache = new Map<string, CachedPlace>()
const pendingPlaceLookups = new Map<string, Promise<VisitorPlace | null>>()
const PLACE_CACHE_LIMIT = 2000

function visitorIpFromHeaders(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for")?.split(",")[0]?.trim() || ""
  return (headers.get("cf-connecting-ip") || headers.get("x-real-ip") || forwarded).trim().slice(0, 64)
}

function isPublicIp(ip: string) {
  const mappedIpv4 = ip.match(/^::ffff:(\d+(?:\.\d+){3})$/i)?.[1]
  if (mappedIpv4) return isPublicIp(mappedIpv4)

  const version = isIP(ip)
  if (version === 4) {
    const [first, second, third] = ip.split(".").map(Number)
    return !(
      first === 0 || first === 10 || first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 192 && second === 0 && third === 0) ||
      (first === 192 && second === 0 && third === 2) ||
      (first === 198 && (second === 18 || second === 19 || (second === 51 && third === 100))) ||
      (first === 203 && second === 0 && third === 113) ||
      first >= 224
    )
  }
  if (version === 6) {
    const normalized = ip.toLowerCase()
    return normalized !== "::" && normalized !== "::1" &&
      !normalized.startsWith("fc") && !normalized.startsWith("fd") &&
      !normalized.startsWith("fe8") && !normalized.startsWith("fe9") &&
      !normalized.startsWith("fea") && !normalized.startsWith("feb") &&
      !normalized.startsWith("ff") && !normalized.startsWith("2001:db8:")
  }
  return false
}

function normalizePlace(data: { success?: boolean; country?: string; country_code?: string; region?: string; city?: string }) {
  if (data.success === false) return null
  const clean = (value: string) => value.trim().replace(/[\u0000-\u001f\u007f]/g, "").slice(0, 80)
  const country = clean(data.country || countryName(data.country_code || ""))
  const city = clean(data.city || "")
  const region = clean(data.region || "")
  return country || city || region ? { country, city, region } : null
}

async function fetchPlace(url: string) {
  try {
    const response = await fetch(url, {
      cache: "no-store",
      signal: AbortSignal.timeout(1000),
      headers: { accept: "application/json" },
    })
    if (!response.ok) return null
    return normalizePlace(await response.json())
  } catch {
    return null
  }
}

async function queryPlace(ip: string): Promise<VisitorPlace | null> {
  const encodedIp = encodeURIComponent(ip)
  const providers = [
    `https://ipwho.is/${encodedIp}`,
    `https://get.geojs.io/v1/ip/geo/${encodedIp}.json`,
  ]

  for (const provider of providers) {
    const place = await fetchPlace(provider)
    if (place) return place
  }
  return null
}

function pooledPlaceLookup(ip: string) {
  const cached = placeCache.get(ip)
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value)

  const pending = pendingPlaceLookups.get(ip)
  if (pending) return pending

  const lookup = queryPlace(ip).then((place) => {
    if (placeCache.size >= PLACE_CACHE_LIMIT) {
      const oldestKey = placeCache.keys().next().value
      if (oldestKey) placeCache.delete(oldestKey)
    }
    placeCache.set(ip, { value: place, expiresAt: Date.now() + (place ? 6 * 60 * 60 * 1000 : 60 * 1000) })
    return place
  }).finally(() => pendingPlaceLookups.delete(ip))

  pendingPlaceLookups.set(ip, lookup)
  return lookup
}

async function locationFromHeaders(headers: Headers) {
  const country = countryName(headerValue(headers, ["x-vercel-ip-country", "cf-ipcountry", "cloudfront-viewer-country", "x-nf-geo-country"]))
  const city = headerValue(headers, ["x-vercel-ip-city", "cf-ipcity", "x-nf-geo-city"]).slice(0, 80)
  const region = headerValue(headers, ["x-vercel-ip-country-region", "cf-region", "x-nf-geo-region"]).slice(0, 80)

  if (country && city) return { country, city: [city, region].filter(Boolean).join(", ") }

  const ip = visitorIpFromHeaders(headers)
  if (!isPublicIp(ip)) return { country, city: [city, region].filter(Boolean).join(", ") }

  const place = await pooledPlaceLookup(ip)
  return {
    country: country || place?.country || "",
    city: [city || place?.city || "", region || place?.region || ""].filter(Boolean).join(", "),
  }
}

export async function trackLinkVisit(code: string, headers: Headers, visitorId: string) {
  const rows = (await sql`
    UPDATE links
    SET visits = visits + 1
    WHERE code = ${code}
    RETURNING code, target_url, visits
  `) as Array<{ code: string; target_url: string; visits: number }>
  const link = rows[0]
  if (!link) return undefined

  const agent = headers.get("user-agent") || ""
  const location = await locationFromHeaders(headers)

  try {
    await sql`
      INSERT INTO link_visit_events (code, visitor_id, country, city, device, operating_system, browser, language, referrer)
      VALUES (
        ${code},
        ${visitorId},
        ${location.country},
        ${location.city},
        ${deviceFromAgent(agent)},
        ${operatingSystemFromAgent(agent)},
        ${browserFromAgent(agent)},
        ${languageFromHeader(headers.get("accept-language") || "")},
        ${referrerFromHeader(headers.get("referer") || "")}
      )
    `
  } catch (error) {
    console.error("Failed to record link visit details:", error)
  }

  return link
}

export async function getLinkReport(code: string, from: Date, to: Date) {
  const rows = await sql`
    WITH target_link AS (
      SELECT code, target_url, visits FROM links WHERE code = ${code}
    ), filtered_events AS (
      SELECT * FROM link_visit_events
      WHERE code = ${code} AND created_at >= ${from} AND created_at < ${to}
    )
    SELECT target_link.code, target_link.target_url, target_link.visits,
      (SELECT COUNT(*)::int FROM filtered_events) AS tracked_visits,
      (SELECT COUNT(DISTINCT visitor_id)::int FROM filtered_events) AS unique_visitors,
      (SELECT COALESCE(json_agg(json_build_object('label', label, 'count', total) ORDER BY total DESC), '[]'::json)
        FROM (
          SELECT COALESCE(NULLIF(country, ''), 'Unknown') AS label, COUNT(*)::int AS total
          FROM filtered_events GROUP BY 1 ORDER BY total DESC LIMIT 5
        ) AS items) AS countries,
      (SELECT COALESCE(json_agg(json_build_object('label', label, 'count', total) ORDER BY total DESC), '[]'::json)
        FROM (
          SELECT COALESCE(NULLIF(city, ''), 'Unknown') AS label, COUNT(*)::int AS total
          FROM filtered_events GROUP BY 1 ORDER BY total DESC LIMIT 5
        ) AS items) AS cities,
      (SELECT COALESCE(json_agg(json_build_object('label', label, 'count', total) ORDER BY total DESC), '[]'::json)
        FROM (
          SELECT device AS label, COUNT(*)::int AS total
          FROM filtered_events GROUP BY device ORDER BY total DESC LIMIT 5
        ) AS items) AS devices,
      (SELECT COALESCE(json_agg(json_build_object('label', label, 'count', total) ORDER BY total DESC), '[]'::json)
        FROM (
          SELECT operating_system AS label, COUNT(*)::int AS total
          FROM filtered_events GROUP BY operating_system ORDER BY total DESC LIMIT 5
        ) AS items) AS operating_systems,
      (SELECT COALESCE(json_agg(json_build_object('label', label, 'count', total) ORDER BY total DESC), '[]'::json)
        FROM (
          SELECT browser AS label, COUNT(*)::int AS total
          FROM filtered_events GROUP BY browser ORDER BY total DESC LIMIT 5
        ) AS items) AS browsers,
      (SELECT COALESCE(json_agg(json_build_object('label', label, 'count', total) ORDER BY total DESC), '[]'::json)
        FROM (
          SELECT language AS label, COUNT(*)::int AS total
          FROM filtered_events GROUP BY language ORDER BY total DESC LIMIT 5
        ) AS items) AS languages,
      (SELECT COALESCE(json_agg(json_build_object('label', label, 'count', total) ORDER BY total DESC), '[]'::json)
        FROM (
          SELECT referrer AS label, COUNT(*)::int AS total
          FROM filtered_events GROUP BY referrer ORDER BY total DESC LIMIT 5
        ) AS items) AS referrers,
      (SELECT COALESCE(json_agg(json_build_object('day', day, 'clicks', clicks) ORDER BY day), '[]'::json)
        FROM (
          SELECT TO_CHAR(DATE_TRUNC('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD') AS day,
            COUNT(*)::int AS clicks
          FROM filtered_events GROUP BY 1
        ) AS daily) AS days,
      (SELECT COALESCE(json_agg(json_build_object(
          'country', country, 'city', city, 'device', device,
          'operating_system', operating_system, 'browser', browser,
          'language', language, 'referrer', referrer, 'created_at', created_at
        ) ORDER BY created_at DESC), '[]'::json)
        FROM (
          SELECT country, city, device, operating_system, browser, language, referrer, created_at
          FROM filtered_events ORDER BY created_at DESC LIMIT 50
        ) AS recent) AS activity
    FROM target_link
  `

  return rows[0]
}