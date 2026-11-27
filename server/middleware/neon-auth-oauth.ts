import { processAuthMiddleware } from '@neon/auth/server'

/**
 * Finishes Google sign-in. Neon Auth sends the browser back to the page it started from with
 * `?neon_auth_session_verifier=…`; this exchanges that one-time value (together with the
 * session-challenge cookie set when sign-in began) for the session cookie, then redirects to the
 * same page without the parameter. Every other request passes straight through: pages are
 * still protected in the browser (app/middleware/auth.ts) and the API checks the session itself.
 */
export default defineEventHandler(async (event) => {
  if (event.method !== 'GET') return
  const url = publicRequestUrl(event)
  if (!url.searchParams.has('neon_auth_session_verifier') || url.pathname.startsWith('/api/')) return

  const result = await processAuthMiddleware({
    request: new Request(url, { headers: getRequestHeaders(event) as Record<string, string> }),
    pathname: url.pathname,
    // Only the OAuth exchange is wanted here, never a redirect to the login page.
    skipRoutes: [url.pathname],
    loginUrl: '/login',
    ...neonAuthConfig()
  })
  for (const cookie of result.cookies ?? []) appendResponseHeader(event, 'set-cookie', cookie)
  if (result.action !== 'allow') return sendRedirect(event, result.redirectUrl.toString(), 302)
})
