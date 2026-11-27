/**
 * Protects a page: `definePageMeta({ middleware: 'auth' })`.
 * Requires a signed-in user with a verified email address.
 *
 * Sign-in state is read in the browser (plugins/auth.client.ts), so on the server this lets the request through
 * and the check runs on the client (Nuxt re-runs middleware there on the initial load).
 * Protected pages should therefore render user-specific content only once `useCurrentUser()`
 * is set — the server-rendered HTML never has a user.
 */
export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const user = await waitForAuth()
  if (!user) return redirectToLogin(to)
  if (!user.emailVerified) return redirectToVerifyEmail(to.fullPath)
})
