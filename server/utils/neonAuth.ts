import type { H3Event } from 'h3'
import { handleAuthProxyRequest } from '@neon/auth/server'

// Neon Auth (Managed Better Auth) through the app's own origin. The browser talks to
// /api/auth/* (server/api/auth/[...path].ts), which forwards to the branch's Neon Auth server
// with @neon/auth's framework-agnostic toolkit. Session cookies therefore belong to this site
// (first-party, SameSite=Lax), not to Neon's domain, so they work in browsers that block
// third-party cookies, and no token has to be sent by hand.
//
// NEON_AUTH_BASE_URL comes from `neon checkout` / `neon env pull` (.env.local) and is an App
// Hosting variable in production; NEON_AUTH_COOKIE_SECRET (32+ characters) signs the cached
// session cookie and is ours to generate (see apphosting.yaml).

export function neonAuthConfig() {
  const baseUrl = process.env.NEON_AUTH_BASE_URL
  const cookieSecret = process.env.NEON_AUTH_COOKIE_SECRET
  if (!baseUrl) throw new Error('NEON_AUTH_BASE_URL is not set. Run `neon checkout <branch>` to write .env.local.')
  if (!cookieSecret || cookieSecret.length < 32) throw new Error('NEON_AUTH_COOKIE_SECRET must be set to 32+ characters.')
  // Lax (not Strict) so the session-challenge cookie comes along when Google sends the browser
  // back after sign-in; cross-site POST/PUT/PATCH/DELETE still never carry the session.
  return { baseUrl, cookieSecret, sameSite: 'lax' as const }
}

/** The request's public URL (App Hosting sits behind a proxy that sets X-Forwarded-*). */
export function publicRequestUrl(event: H3Event) {
  return getRequestURL(event, { xForwardedHost: true, xForwardedProto: true })
}

export interface NeonAuthUser {
  id: string
  email: string
  name: string
  image: string | null
  emailVerified: boolean
}

/**
 * The session of the user making the request, or null when signed out. Served from the signed
 * session_data cookie while it's fresh (up to 5 minutes, no network call), otherwise checked
 * with Neon Auth; refreshed cookies are passed on to the response. `fresh` always asks Neon Auth,
 * e.g. when the cached copy may predate a change such as verifying the email address.
 */
export async function getNeonSession(event: H3Event, { fresh = false } = {}): Promise<{ user: NeonAuthUser } | null> {
  const headers = new Headers()
  const cookie = getHeader(event, 'cookie')
  if (!cookie) return null
  headers.set('cookie', cookie)
  const url = new URL('/api/auth/get-session', publicRequestUrl(event))
  if (fresh) url.searchParams.set('disableCookieCache', 'true')
  const response = await handleAuthProxyRequest({
    request: new Request(url, { headers }),
    path: 'get-session',
    ...neonAuthConfig()
  })
  for (const setCookie of response.headers.getSetCookie()) appendResponseHeader(event, 'set-cookie', setCookie)
  if (response.status === 401) return null
  if (!response.ok) throw createError({ statusCode: 502, statusMessage: 'Sign-in service unavailable' })
  const data = await response.json().catch(() => null) as { user?: NeonAuthUser } | null
  return data?.user ? { user: data.user } : null
}
