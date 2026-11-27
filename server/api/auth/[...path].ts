import { handleAuthProxyRequest } from '@neon/auth/server'

/**
 * /api/auth/* — the browser's Neon Auth endpoint (sign-in, sign-up, sessions, email codes,
 * profile updates, Google sign-in). Forwards to the branch's Neon Auth server and rewrites its
 * cookies onto this site; see server/utils/neonAuth.ts.
 */
export default defineEventHandler(async (event) => {
  const path = getRouterParam(event, 'path') ?? ''
  const url = publicRequestUrl(event)
  const method = event.method
  const hasBody = method !== 'GET' && method !== 'HEAD'
  // Forward the body verbatim (parsing it would change what upstream receives).
  const body = hasBody ? await readRawBody(event, false) : undefined
  const request = new Request(url, {
    method,
    headers: getRequestHeaders(event) as Record<string, string>,
    body: body?.length ? new Uint8Array(body) : undefined
  })
  return handleAuthProxyRequest({ request, path, ...neonAuthConfig() })
})
