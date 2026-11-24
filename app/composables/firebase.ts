import { getAuth, signOut, type User } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

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

/**
 * Reactive signed-in user. `undefined` while auth is resolving (and always on the server),
 * `null` when signed out. Call in component setup; safe during SSR.
 */
export function useCurrentUser(): Readonly<Ref<User | null | undefined>> {
  if (import.meta.server) return shallowRef(undefined)
  return useNuxtApp().$currentUser
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

/** Resolves once Firebase has restored the persisted session (client-only). */
export async function waitForAuth(): Promise<User | null> {
  const auth = useFirebaseAuth()
  await auth.authStateReady()
  return auth.currentUser
}
