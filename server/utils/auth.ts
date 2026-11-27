import type { H3Event } from 'h3'

export interface AuthUser {
  /** Neon Auth user id (neon_auth.user.id); stored as `owner` / `applicant` / `uid`. */
  uid: string
  email: string
  name: string | null
}

/**
 * The signed-in user making the request, from their Neon Auth session cookie (see
 * server/utils/neonAuth.ts). Throws 401 when signed out, and 403 when the email address isn't
 * verified (the app requires a verified email for every signed-in page).
 */
export async function requireUser(event: H3Event): Promise<AuthUser> {
  let session = await getNeonSession(event)
  if (!session) throw createError({ statusCode: 401, statusMessage: 'Sign-in required' })
  // The cached session can be up to 5 minutes old, so "unverified" may be out of date (the user
  // just entered their code): ask Neon Auth before refusing.
  if (!session.user.emailVerified) session = await getNeonSession(event, { fresh: true })
  if (!session) throw createError({ statusCode: 401, statusMessage: 'Sign-in required' })
  const { user } = session
  if (!user.emailVerified) throw createError({ statusCode: 403, statusMessage: 'Email address not verified' })
  return { uid: user.id, email: user.email, name: user.name || null }
}
