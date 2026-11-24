import type { RouteLocationNormalizedLoaded } from 'vue-router'

/** Whether the route (or any parent route) uses the `auth` middleware. */
export function routeRequiresAuth(route: RouteLocationNormalizedLoaded): boolean {
  return route.matched.some((record) => {
    const middleware = record.meta.middleware
    return Array.isArray(middleware) ? middleware.includes('auth') : middleware === 'auth'
  })
}

/** Navigate to the localized login page, returning to `route` after sign-in. */
export function redirectToLogin(route: RouteLocationNormalizedLoaded) {
  const { $localePath } = useNuxtApp()
  return navigateTo($localePath({ path: '/login', query: { redirect: route.fullPath } }), { replace: true })
}
