import type { RouteLocationNormalizedLoaded } from 'vue-router'

/** Max length of a user's display name (sign-up and account page). */
export const MAX_DISPLAY_NAME_LENGTH = 50

/** Whether the route (or any parent route) uses the `auth` middleware. */
export function routeRequiresAuth(route: RouteLocationNormalizedLoaded): boolean {
  return route.matched.some((record) => {
    const middleware = record.meta.middleware
    return Array.isArray(middleware) ? middleware.includes('auth') : middleware === 'auth'
  })
}

/**
 * Returns `value` if it is a same-site relative path, otherwise `fallback`.
 * Rejects `//host` and `/\host`, which browsers treat as protocol-relative URLs.
 */
export function safeRedirect(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^\/(?![/\\])/.test(value) ? value : fallback
}

/** Navigate to the localized login page, returning to `route` after sign-in. */
export function redirectToLogin(route: RouteLocationNormalizedLoaded) {
  const { $localePath } = useNuxtApp()
  return navigateTo($localePath({ path: '/login', query: { redirect: route.fullPath } }), { replace: true })
}

/** Navigate to the localized verify-email page, returning to `redirect` once verified. */
export function redirectToVerifyEmail(redirect: string) {
  const { $localePath } = useNuxtApp()
  return navigateTo($localePath({ path: '/verify-email', query: { redirect } }), { replace: true })
}
