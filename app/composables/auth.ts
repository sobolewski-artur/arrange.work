// Sign-in with Neon Auth (Managed Better Auth); the client is created in plugins/auth.client.ts.
import type { VanillaBetterAuthClient } from '@neon/auth'

/** The signed-in user, as the app uses it. */
export interface AppUser {
  /** Neon Auth user id; stored as `owner` / `applicant` on jobs and applications. */
  uid: string
  email: string
  displayName: string | null
  photoURL: string | null
  emailVerified: boolean
}

export function toAppUser(user: { id: string, email: string, name?: string | null, image?: string | null, emailVerified: boolean }): AppUser {
  return {
    uid: user.id,
    email: user.email,
    displayName: user.name || null,
    photoURL: user.image || null,
    emailVerified: user.emailVerified
  }
}

function requireClient(name: string) {
  if (import.meta.server) {
    throw new Error(`${name}() is client-only — call it in onMounted, an event handler, or <ClientOnly>.`)
  }
}

type AuthResult<T> = Promise<{ data: T, error: null } | { data: null, error: { code?: string, status?: number, message?: string } }>

/**
 * The email-code (email OTP) methods the app uses. They exist at runtime (@neon/auth includes
 * Better Auth's emailOTPClient plugin), but @neon/auth 0.8's exported client type doesn't carry
 * plugin methods, so they're declared here.
 */
interface EmailOtpMethods {
  emailOtp: {
    sendVerificationOtp(input: { email: string, type: 'email-verification' | 'sign-in' | 'forget-password' }): AuthResult<{ success: boolean }>
    verifyEmail(input: { email: string, otp: string }): AuthResult<unknown>
    requestPasswordReset(input: { email: string }): AuthResult<{ success: boolean }>
    resetPassword(input: { email: string, otp: string, password: string }): AuthResult<{ success: boolean }>
  }
}

export type AppAuthClient = VanillaBetterAuthClient & EmailOtpMethods

/** The Better Auth client (client-only). Methods return `{ data, error }`; see `unwrap`. */
export function useAuthClient(): AppAuthClient {
  requireClient('useAuthClient')
  return useNuxtApp().$authClient as AppAuthClient
}

/**
 * Reactive signed-in user. `undefined` while auth is resolving (and always on the server),
 * `null` when signed out. Call in component setup; safe during SSR.
 */
export function useCurrentUser(): Readonly<Ref<AppUser | null | undefined>> {
  if (import.meta.server) return shallowRef(undefined)
  return useNuxtApp().$currentUser
}

/** Reads the session again and updates `useCurrentUser()`; `fresh` bypasses the session caches. */
export function refreshCurrentUser(options?: { fresh?: boolean }) {
  requireClient('refreshCurrentUser')
  return useNuxtApp().$refreshSession(options)
}

/** Resolves once the stored session has been checked (client-only). */
export async function waitForAuth(): Promise<AppUser | null> {
  requireClient('waitForAuth')
  const nuxtApp = useNuxtApp()
  await nuxtApp.$authReady
  return nuxtApp.$currentUser.value ?? null
}

/**
 * Signs out and goes to the home page. Navigating first means a protected page
 * isn't bounced to /login by the sign-out handling in plugins/auth.client.ts.
 */
export async function signOutUser() {
  const { $localePath } = useNuxtApp()
  await navigateTo($localePath('/'))
  await useAuthClient().signOut()
  await refreshCurrentUser({ fresh: true }).catch(() => {})
}

// --- Errors ---

/** A failed Better Auth call: `code` is Better Auth's error code (e.g. INVALID_OTP), if any. */
export class AuthFailure extends Error {
  constructor(readonly code: string | undefined, readonly status: number | undefined, message?: string) {
    super(message || code || 'Authentication failed')
  }

  /** The request never got an answer. */
  get isNetwork() {
    return !this.status
  }
}

/** The data of a Better Auth `{ data, error }` result; throws AuthFailure for an error. */
export async function unwrap<T>(call: Promise<{ data: T, error: null } | { data: null, error: { code?: string, status?: number, message?: string } }>): Promise<T> {
  let result
  try {
    result = await call
  } catch (e) {
    throw new AuthFailure(undefined, undefined, (e as Error)?.message)
  }
  if (result.error) throw new AuthFailure(result.error.code, result.error.status, result.error.message)
  return result.data as T
}

// --- Email codes (Neon Auth sends them; links would need a custom SMTP provider) ---

/** Emails a 6-digit code that verifies the address. */
export async function sendVerificationCode(email: string) {
  await unwrap(useAuthClient().emailOtp.sendVerificationOtp({ email, type: 'email-verification' }))
}

const CODE_SENT_KEY = 'arrange-work:verification-code-sent:'

/** Remembers (for this tab) when a verification code was sent, so the verify page doesn't send another at once. */
export function markVerificationCodeSent(email: string) {
  try {
    sessionStorage.setItem(CODE_SENT_KEY + email.toLowerCase(), String(Date.now()))
  } catch {
    // Storage unavailable: the verify page just sends a code itself.
  }
}

/** When markVerificationCodeSent last ran for `email` in this tab, or null. */
export function verificationCodeSentAt(email: string): Date | null {
  try {
    const value = Number(sessionStorage.getItem(CODE_SENT_KEY + email.toLowerCase()))
    return value ? new Date(value) : null
  } catch {
    return null
  }
}

/** Verifies the signed-in user's email with the emailed code, then reloads the session. */
export async function verifyEmailCode(email: string, otp: string) {
  await unwrap(useAuthClient().emailOtp.verifyEmail({ email, otp }))
  return refreshCurrentUser({ fresh: true })
}
