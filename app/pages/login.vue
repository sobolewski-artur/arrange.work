<script setup lang="ts">
import type { FirebaseError } from 'firebase/app'
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getRedirectResult,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  updateProfile,
  type User
} from 'firebase/auth'

const { t, locale } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const router = useRouter()
const user = useCurrentUser()

// Google creates the account on first sign-in, so for Google the mode only changes the wording.
// For email/password, sign-up creates the account and sign-in requires an existing one.
const mode = computed<'signin' | 'signup'>(() => (route.query.mode === 'signup' ? 'signup' : 'signin'))

useHead(() => ({ title: mode.value === 'signup' ? t('auth.signUp') : t('auth.signIn') }))

const displayName = ref('')
const email = ref('')
const password = ref('')
const pending = ref<'google' | 'email' | 'reset' | null>(null)
const error = ref<string | null>(null)
const notice = ref<string | null>(null)

// Minimum length from the project's password policy (Firebase console → Authentication → Settings).
const MIN_PASSWORD_LENGTH = 6

const redirectTo = computed(() => safeRedirect(route.query.redirect, localePath('/')))

// Unverified email/password accounts go to /verify-email first (Google accounts are verified).
function continueAfterSignIn(u: User) {
  if (!u.emailVerified) return redirectToVerifyEmail(redirectTo.value)
  return navigateTo(redirectTo.value, { replace: true })
}

// Already signed in (or returning from the Google redirect fallback). While a sign-in started
// on this page is in progress, its handler navigates instead, after any follow-up work.
watch(user, (u) => {
  if (u && !pending.value) continueAfterSignIn(u)
}, { immediate: true })

function resetMessages() {
  error.value = null
  notice.value = null
}

function toggleMode() {
  resetMessages()
  password.value = ''
  router.replace({ query: { ...route.query, mode: mode.value === 'signup' ? undefined : 'signup' } })
}

function errorMessage(code: string | undefined): string | null {
  switch (code) {
    case 'auth/popup-closed-by-user':
    case 'auth/cancelled-popup-request':
    case 'auth/user-cancelled':
      return null
    // With email enumeration protection on, wrong password and unknown email both
    // come back as invalid-credential.
    case 'auth/invalid-credential':
    case 'auth/invalid-login-credentials':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return t('auth.errors.invalidCredentials')
    case 'auth/invalid-email':
      return t('auth.errors.invalidEmail')
    case 'auth/missing-password':
      return t('auth.errors.missingPassword')
    case 'auth/email-already-in-use':
      return t('auth.errors.emailInUse')
    case 'auth/weak-password':
    case 'auth/password-does-not-meet-requirements':
      return t('auth.errors.weakPassword', { min: MIN_PASSWORD_LENGTH })
    case 'auth/user-disabled':
      return t('auth.errors.userDisabled')
    case 'auth/too-many-requests':
      return t('auth.errors.tooManyRequests')
    case 'auth/operation-not-allowed':
      return t('auth.errors.operationNotAllowed')
    case 'auth/unauthorized-domain':
      return t('auth.errors.unauthorizedDomain')
    case 'auth/network-request-failed':
      return t('auth.errors.network')
    case 'auth/account-exists-with-different-credential':
      return t('auth.errors.accountExists')
    default:
      return t('auth.errors.generic')
  }
}

function fail(e: unknown) {
  console.error(e)
  error.value = errorMessage((e as FirebaseError).code)
}

async function continueWithGoogle() {
  resetMessages()
  pending.value = 'google'

  const auth = useFirebaseAuth()
  auth.languageCode = locale.value
  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })

  try {
    const { user: signedIn } = await signInWithPopup(auth, provider)
    await continueAfterSignIn(signedIn)
  } catch (e) {
    if ((e as FirebaseError).code === 'auth/popup-blocked') {
      await signInWithRedirect(auth, provider)
      return
    }
    fail(e)
  } finally {
    pending.value = null
  }
}

async function submitEmail() {
  resetMessages()
  pending.value = 'email'
  const auth = useFirebaseAuth()

  try {
    if (mode.value === 'signup') {
      const { user: created } = await createUserWithEmailAndPassword(auth, email.value.trim(), password.value)
      // Set the name before sending the verification email, so its template can use %DISPLAY_NAME%.
      // The account already exists at this point, so a failure here shouldn't block sign-up.
      try {
        await updateProfile(created, { displayName: displayName.value.trim() })
      } catch (e) {
        console.error(e)
      }
      try {
        await sendVerificationEmail(created, redirectTo.value)
      } catch (e) {
        // The verify-email page offers "Resend".
        console.error(e)
      }
      await continueAfterSignIn(created)
    } else {
      const { user: signedIn } = await signInWithEmailAndPassword(auth, email.value.trim(), password.value)
      await continueAfterSignIn(signedIn)
    }
  } catch (e) {
    fail(e)
  } finally {
    pending.value = null
  }
}

async function forgotPassword() {
  resetMessages()
  if (!email.value.trim()) {
    error.value = t('auth.errors.enterEmailForReset')
    return
  }

  pending.value = 'reset'
  const auth = useFirebaseAuth()
  auth.languageCode = locale.value

  try {
    await sendPasswordResetEmail(auth, email.value.trim())
    // Same message whether or not the account exists (don't reveal registered emails).
    notice.value = t('auth.resetSent')
  } catch (e) {
    if ((e as FirebaseError).code === 'auth/user-not-found') notice.value = t('auth.resetSent')
    else fail(e)
  } finally {
    pending.value = null
  }
}

// Surface errors from the Google redirect fallback (no-op when there was no redirect).
onMounted(() => {
  getRedirectResult(useFirebaseAuth()).catch(fail)
})

const busy = computed(() => pending.value !== null || user.value !== null)
const inputClass = 'mt-1 block w-full rounded-lg bg-surface px-3 py-2 text-sm ring-1 ring-line-strong placeholder:text-subtle focus:outline-2 focus:outline-offset-0 focus:outline-fg disabled:opacity-60'
</script>

<template>
  <main class="min-h-screen flex items-center justify-center bg-page px-4 text-fg">
    <div class="w-full max-w-sm rounded-2xl bg-surface p-8 shadow-sm ring-1 ring-line">
      <NuxtLink :to="localePath('/')" class="text-sm font-semibold tracking-tight text-muted hover:text-fg">
        arrange.work
      </NuxtLink>

      <h1 class="mt-6 text-2xl font-bold tracking-tight">
        {{ mode === 'signup' ? $t('auth.signUpTitle') : $t('auth.signInTitle') }}
      </h1>
      <p class="mt-1 text-sm text-muted">
        {{ mode === 'signup' ? $t('auth.signUpSubtitle') : $t('auth.signInSubtitle') }}
      </p>

      <button
        type="button"
        class="mt-8 flex w-full items-center justify-center gap-3 rounded-lg bg-surface px-4 py-2.5 text-sm font-medium ring-1 ring-line-strong transition hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="busy"
        @click="continueWithGoogle"
      >
        <svg class="size-5" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
          <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
          <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
          <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
        </svg>
        <span v-if="pending === 'google'">{{ $t('auth.pendingGoogle') }}</span>
        <span v-else>{{ mode === 'signup' ? $t('auth.signUpWithGoogle') : $t('auth.signInWithGoogle') }}</span>
      </button>

      <div class="my-6 flex items-center gap-3 text-xs uppercase tracking-wide text-subtle">
        <span class="h-px flex-1 bg-line" />
        {{ $t('auth.or') }}
        <span class="h-px flex-1 bg-line" />
      </div>

      <form class="space-y-4" @submit.prevent="submitEmail">
        <label v-if="mode === 'signup'" class="block text-sm font-medium">
          {{ $t('auth.displayName') }}
          <input
            v-model="displayName"
            type="text"
            name="name"
            autocomplete="name"
            required
            pattern=".*\S.*"
            :maxlength="MAX_DISPLAY_NAME_LENGTH"
            :title="$t('auth.errors.missingDisplayName')"
            :disabled="busy"
            :class="inputClass"
          >
        </label>

        <label class="block text-sm font-medium">
          {{ $t('auth.email') }}
          <input
            v-model="email"
            type="email"
            name="email"
            autocomplete="email"
            required
            :disabled="busy"
            :class="inputClass"
          >
        </label>

        <div>
          <div class="flex items-baseline justify-between">
            <label for="password" class="text-sm font-medium">{{ $t('auth.password') }}</label>
            <button
              v-if="mode === 'signin'"
              type="button"
              class="text-xs text-muted underline-offset-4 hover:text-fg hover:underline disabled:opacity-60"
              :disabled="busy"
              @click="forgotPassword"
            >
              {{ $t('auth.forgotPassword') }}
            </button>
          </div>
          <input
            id="password"
            v-model="password"
            type="password"
            name="password"
            :autocomplete="mode === 'signup' ? 'new-password' : 'current-password'"
            :minlength="mode === 'signup' ? MIN_PASSWORD_LENGTH : undefined"
            required
            :disabled="busy"
            :class="inputClass"
          >
          <p v-if="mode === 'signup'" class="mt-1 text-xs text-muted">
            {{ $t('auth.passwordHint', { min: MIN_PASSWORD_LENGTH }) }}
          </p>
        </div>

        <button
          type="submit"
          class="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-on-primary transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="busy"
        >
          <template v-if="pending === 'email'">{{ $t('auth.pending') }}</template>
          <template v-else>{{ mode === 'signup' ? $t('auth.createAccount') : $t('auth.signIn') }}</template>
        </button>
      </form>

      <p v-if="error" role="alert" class="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger ring-1 ring-danger-line">
        {{ error }}
      </p>
      <p v-if="notice" role="status" class="mt-4 rounded-lg bg-success-soft px-3 py-2 text-sm text-success ring-1 ring-success-line">
        {{ notice }}
      </p>

      <p class="mt-8 text-center text-sm text-muted">
        {{ mode === 'signup' ? $t('auth.haveAccount') : $t('auth.noAccount') }}
        <button type="button" class="font-medium text-fg underline-offset-4 hover:underline" @click="toggleMode">
          {{ mode === 'signup' ? $t('auth.signIn') : $t('auth.signUp') }}
        </button>
      </p>
    </div>
  </main>
</template>
