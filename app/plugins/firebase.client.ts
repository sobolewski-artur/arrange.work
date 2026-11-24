import { getApps, initializeApp } from 'firebase/app'
import { getAuth, onAuthStateChanged, type User } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'

// Firebase runs in the browser only. On the server there is no signed-in user,
// so server-rendered HTML always reflects the "auth not resolved yet" state.
export default defineNuxtPlugin((nuxtApp) => {
  const config = useRuntimeConfig().public.firebase

  const firebaseApp = getApps()[0] ?? initializeApp(config)
  const auth = getAuth(firebaseApp)
  const firestore = getFirestore(firebaseApp)

  // undefined = not resolved yet, null = signed out
  const currentUser = shallowRef<User | null | undefined>(undefined)
  onAuthStateChanged(auth, (user) => {
    const signedOut = !!currentUser.value && !user
    currentUser.value = user

    // Middleware only runs on navigation, so handle losing the session (sign-out in another
    // tab, revoked token, …) while a protected page is open.
    if (signedOut) {
      const route = nuxtApp.$router.currentRoute.value
      if (routeRequiresAuth(route)) nuxtApp.runWithContext(() => redirectToLogin(route))
    }
  })

  return {
    provide: {
      firebaseApp,
      auth,
      firestore,
      currentUser
    }
  }
})
