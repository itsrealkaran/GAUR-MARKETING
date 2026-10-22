import crypto from "crypto"
import { neon } from "@neondatabase/serverless"

const databaseUrl = process.env.DATABASE_URL_POOLED || process.env.DATABASE_URL

export const sql = neon(databaseUrl || "")

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
  const countryCode = headerValue(headers, ["x-vercel-ip-country", "cf-ipcountry", "cloudfront-viewer-country", "x-nf-geo-country"])
  const country = countryName(countryCode)
  const city = headerValue(headers, ["x-vercel-ip-city", "cf-ipcity", "x-nf-geo-city"]).slice(0, 80)
  const region = headerValue(headers, ["x-vercel-ip-country-region", "cf-region", "x-nf-geo-region"]).slice(0, 80)

  try {
    await sql`
      INSERT INTO link_visit_events (code, visitor_id, country, city, device, operating_system, browser, language, referrer)
      VALUES (
        ${code},
        ${visitorId},
        ${country},
        ${[city, region].filter(Boolean).join(", ")},
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

export async function getLinkAnalytics(codes: string[]) {
  if (!codes.length) return []

  return sql`
    WITH page_codes AS (
      SELECT json_array_elements_text(${JSON.stringify(codes)}::json) AS code
    )
    SELECT page_codes.code,
      (SELECT COUNT(*)::int FROM link_visit_events e WHERE e.code = page_codes.code) AS tracked_visits,
      (SELECT COUNT(DISTINCT visitor_id)::int FROM link_visit_events e WHERE e.code = page_codes.code) AS unique_visitors,
      (SELECT COALESCE(json_agg(json_build_object('label', label, 'count', visits) ORDER BY visits DESC), '[]'::json)
        FROM (
          SELECT COALESCE(NULLIF(country, ''), 'Unknown') AS label, COUNT(*)::int AS visits
          FROM link_visit_events e WHERE e.code = page_codes.code
          GROUP BY 1 ORDER BY visits DESC LIMIT 5
        ) AS items) AS countries,
      (SELECT COALESCE(json_agg(json_build_object('label', label, 'count', visits) ORDER BY visits DESC), '[]'::json)
        FROM (
          SELECT COALESCE(NULLIF(city, ''), 'Unknown') AS label, COUNT(*)::int AS visits
          FROM link_visit_events e WHERE e.code = page_codes.code
          GROUP BY 1 ORDER BY visits DESC LIMIT 5
        ) AS items) AS cities,
      (SELECT COALESCE(json_agg(json_build_object('label', label, 'count', visits) ORDER BY visits DESC), '[]'::json)
        FROM (
          SELECT device AS label, COUNT(*)::int AS visits
          FROM link_visit_events e WHERE e.code = page_codes.code
          GROUP BY device ORDER BY visits DESC LIMIT 5
        ) AS items) AS devices,
      (SELECT COALESCE(json_agg(json_build_object('label', label, 'count', visits) ORDER BY visits DESC), '[]'::json)
        FROM (
          SELECT operating_system AS label, COUNT(*)::int AS visits
          FROM link_visit_events e WHERE e.code = page_codes.code
          GROUP BY operating_system ORDER BY visits DESC LIMIT 5
        ) AS items) AS operating_systems,
      (SELECT COALESCE(json_agg(json_build_object('label', label, 'count', visits) ORDER BY visits DESC), '[]'::json)
        FROM (
          SELECT browser AS label, COUNT(*)::int AS visits
          FROM link_visit_events e WHERE e.code = page_codes.code
          GROUP BY browser ORDER BY visits DESC LIMIT 5
        ) AS items) AS browsers,
      (SELECT COALESCE(json_agg(json_build_object('label', label, 'count', visits) ORDER BY visits DESC), '[]'::json)
        FROM (
          SELECT language AS label, COUNT(*)::int AS visits
          FROM link_visit_events e WHERE e.code = page_codes.code
          GROUP BY language ORDER BY visits DESC LIMIT 5
        ) AS items) AS languages,
      (SELECT COALESCE(json_agg(json_build_object('label', label, 'count', visits) ORDER BY visits DESC), '[]'::json)
        FROM (
          SELECT referrer AS label, COUNT(*)::int AS visits
          FROM link_visit_events e WHERE e.code = page_codes.code
          GROUP BY referrer ORDER BY visits DESC LIMIT 5
        ) AS items) AS referrers
    FROM page_codes
  `
}