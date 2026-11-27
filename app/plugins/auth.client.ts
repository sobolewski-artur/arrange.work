import { createAuthClient } from '@neon/auth'

// Neon Auth (Managed Better Auth) runs through this site's /api/auth proxy
// (server/api/auth/[...path].ts), so the session is a first-party cookie. Sign-in state lives in
// the browser only: server-rendered HTML always reflects "auth not resolved yet".
export default defineNuxtPlugin((nuxtApp) => {
  // The default (vanilla, Promise-based) adapter: Better Auth client methods with Neon's plugin set.
  const authClient = createAuthClient(`${window.location.origin}/api/auth`)

  // undefined = not resolved yet, null = signed out
  const currentUser = shallowRef<AppUser | null | undefined>(undefined)

  function setUser(user: AppUser | null) {
    const signedOut = !!currentUser.value && !user
    currentUser.value = user
    // Middleware only runs on navigation, so handle losing the session (sign-out in another
    // tab, expired session, …) while a protected page is open.
    if (signedOut) {
      const route = nuxtApp.$router.currentRoute.value
      if (routeRequiresAuth(route)) nuxtApp.runWithContext(() => redirectToLogin(route))
    }
  }

  /**
   * Reads the session again. `fresh` skips the caches (the browser's and the proxy's signed
   * cookie), for right after something changed the user, e.g. verifying their email.
   */
  async function refreshSession({ fresh = false } = {}) {
    const { data, error } = await authClient.getSession(fresh
      ? { query: { disableCookieCache: true }, fetchOptions: { headers: { 'X-Force-Fetch': 'true' } } }
      : undefined)
    if (error) {
      // Keep the current state on a failed refresh; only the first check decides "signed out".
      if (currentUser.value === undefined) setUser(null)
      throw error
    }
    setUser(data?.user ? toAppUser(data.user) : null)
    return currentUser.value ?? null
  }

  const ready = refreshSession().catch((e) => {
    console.warn('Could not restore the session', e)
    return null
  })

  // Pick up sign-in or sign-out in another tab when this one is shown again.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshSession().catch(() => {})
  })

  return {
    provide: {
      authClient,
      currentUser,
      refreshSession,
      authReady: ready
    }
  }
})
