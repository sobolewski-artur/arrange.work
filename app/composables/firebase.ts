import { getAuth, sendEmailVerification, signOut, type User } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

function requireClient(name: string) {
  if (import.meta.server) {
    throw new Error(`${name}() is client-only — call it in onMounted, an event handler, or <ClientOnly>.`)
  }
}

// These use Firebase's default-app singletons (initialized by plugins/firebase.client.ts)
// rather than useNuxtApp(), so they also work outside component setup, e.g. in event handlers.

/** Firebase Auth instance (client-only). */
export function useFirebaseAuth() {
  requireClient('useFirebaseAuth')
  return getAuth()
}

/** Firestore instance (client-only). */
export function useFirestore() {
  requireClient('useFirestore')
  return getFirestore()
}

/** Cloud Storage instance for the default bucket (client-only). */
export function useFirebaseStorage() {
  requireClient('useFirebaseStorage')
  return getStorage()
}

/**
 * Reactive signed-in user. `undefined` while auth is resolving (and always on the server),
 * `null` when signed out. Call in component setup; safe during SSR.
 */
export function useCurrentUser(): Readonly<Ref<User | null | undefined>> {
  if (import.meta.server) return shallowRef(undefined)
  return useNuxtApp().$currentUser
}

/**
 * Notifies `useCurrentUser()` watchers after mutating the User in place (e.g. `updateProfile`),
 * which Firebase only reports when the ID token also changes.
 */
export function refreshCurrentUser() {
  if (import.meta.server) return
  triggerRef(useNuxtApp().$currentUser)
}

/**
 * Signs out and goes to the home page. Navigating first means a protected page
 * isn't bounced to /login by the sign-out watcher in plugins/firebase.client.ts.
 */
export async function signOutUser() {
  const { $localePath } = useNuxtApp()
  await navigateTo($localePath('/'))
  await signOut(useFirebaseAuth())
}

/**
 * Sends the verification email in the current locale. The link's "Continue" button returns to
 * /verify-email, which then forwards to `redirect`. The continue URL's domain must be listed in
 * Firebase console → Authentication → Settings → Authorized domains.
 */
export function sendVerificationEmail(user: User, redirect?: string) {
  const { $i18n, $localePath } = useNuxtApp()
  useFirebaseAuth().languageCode = $i18n.locale.value
  const continuePath = $localePath({ path: '/verify-email', query: redirect ? { redirect } : {} })
  return sendEmailVerification(user, { url: new URL(continuePath, window.location.origin).href })
}

/** Resolves once Firebase has restored the persisted session (client-only). */
export async function waitForAuth(): Promise<User | null> {
  const auth = useFirebaseAuth()
  await auth.authStateReady()
  return auth.currentUser
}
