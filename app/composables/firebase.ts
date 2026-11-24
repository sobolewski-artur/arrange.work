import type { User } from 'firebase/auth'

function requireClient(name: string) {
  if (import.meta.server) {
    throw new Error(`${name}() is client-only — call it in onMounted, a .client component, or <ClientOnly>.`)
  }
}

/** Firebase Auth instance (client-only). */
export function useFirebaseAuth() {
  requireClient('useFirebaseAuth')
  return useNuxtApp().$auth
}

/** Firestore instance (client-only). */
export function useFirestore() {
  requireClient('useFirestore')
  return useNuxtApp().$firestore
}

/**
 * Reactive signed-in user. `undefined` while auth is resolving (and always on the server),
 * `null` when signed out. Safe to call during SSR.
 */
export function useCurrentUser(): Readonly<Ref<User | null | undefined>> {
  if (import.meta.server) return shallowRef(undefined)
  return useNuxtApp().$currentUser
}

/** Resolves once Firebase has restored the persisted session (client-only). */
export async function waitForAuth(): Promise<User | null> {
  const auth = useFirebaseAuth()
  await auth.authStateReady()
  return auth.currentUser
}
