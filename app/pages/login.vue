<script setup lang="ts">
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const router = useRouter()
const user = useCurrentUser()

// Google creates the account on first sign-in, so for Google the mode only changes the wording.
// For email/password, sign-up creates the account and sign-in requires an existing one.
const mode = computed<'signin' | 'signup'>(() => (route.query.mode === 'signup' ? 'signup' : 'signin'))

const displayName = ref('')
const email = ref('')
const password = ref('')
const pending = ref<'google' | 'email' | 'reset' | null>(null)
const error = ref<string | null>(null)
const notice = ref<string | null>(null)

/** Neon Auth's (Better Auth's) minimum password length. */
const MIN_PASSWORD_LENGTH = 8

const redirectTo = computed(() => safeRedirect(route.query.redirect, localePath('/')))

// Password reset with an emailed 6-digit code: "Forgot password?" sends it, then this form
// takes the code and a new password.
const resetStep = ref<'off' | 'code'>('off')
const resetCode = ref('')
const newPassword = ref('')

useHead(() => ({
  title: resetStep.value === 'code' ? t('auth.resetTitle') : mode.value === 'signup' ? t('auth.signUp') : t('auth.signIn')
}))

// Unverified email/password accounts go to /verify-email first (Google accounts are verified).
function continueAfterSignIn(u: AppUser) {
  if (!u.emailVerified) return redirectToVerifyEmail(redirectTo.value)
  return navigateTo(redirectTo.value, { replace: true })
}

// Already signed in (or just back from Google). While a sign-in started on this page is in
// progress, its handler navigates instead, after any follow-up work.
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
  resetStep.value = 'off'
  router.replace({ query: { ...route.query, mode: mode.value === 'signup' ? undefined : 'signup' } })
}

function errorMessage(e: unknown): string {
  if (!(e instanceof AuthFailure)) return t('auth.errors.generic')
  if (e.isNetwork) return t('auth.errors.network')
  if (e.status === 429) return t('auth.errors.tooManyRequests')
  switch (e.code) {
    // Wrong password and unknown email look the same, so registered emails aren't revealed.
    case 'INVALID_EMAIL_OR_PASSWORD':
    case 'CREDENTIAL_ACCOUNT_NOT_FOUND':
    case 'USER_NOT_FOUND':
      return t('auth.errors.invalidCredentials')
    case 'INVALID_EMAIL':
      return t('auth.errors.invalidEmail')
    case 'USER_ALREADY_EXISTS':
    case 'USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL':
      return t('auth.errors.emailInUse')
    case 'PASSWORD_TOO_SHORT':
      return t('auth.errors.weakPassword', { min: MIN_PASSWORD_LENGTH })
    case 'PASSWORD_TOO_LONG':
      return t('auth.errors.passwordTooLong')
    case 'BANNED_USER':
      return t('auth.errors.userDisabled')
    case 'INVALID_OTP':
      return t('auth.errors.invalidCode')
    case 'OTP_EXPIRED':
      return t('auth.errors.codeExpired')
    case 'TOO_MANY_ATTEMPTS':
      return t('auth.errors.tooManyCodeAttempts')
    default:
      return t('auth.errors.generic')
  }
}

function fail(e: unknown) {
  console.error(e)
  error.value = errorMessage(e)
}

async function continueWithGoogle() {
  resetMessages()
  pending.value = 'google'
  try {
    // Neon Auth sends the browser to Google and back to `callbackURL`, where
    // server/middleware/neon-auth-oauth.ts finishes the sign-in. Failures come back to this
    // page with ?error=… (see onMounted).
    await unwrap(useAuthClient().signIn.social({
      provider: 'google',
      callbackURL: new URL(redirectTo.value, window.location.origin).href,
      errorCallbackURL: new URL(route.fullPath, window.location.origin).href
    }))
    // The page is navigating to Google now; stay "pending" until it does.
  } catch (e) {
    fail(e)
    pending.value = null
  }
}

async function submitEmail() {
  resetMessages()
  pending.value = 'email'
  const client = useAuthClient()
  const address = email.value.trim()

  try {
    if (mode.value === 'signup') {
      await unwrap(client.signUp.email({ email: address, password: password.value, name: displayName.value.trim() }))
      // The account exists at this point, so a failed email shouldn't block sign-up:
      // the verify-email page offers "Resend code".
      try {
        await sendVerificationCode(address)
        markVerificationCodeSent(address)
      } catch (e) {
        console.error(e)
      }
    } else {
      await unwrap(client.signIn.email({ email: address, password: password.value }))
    }
    const signedIn = await refreshCurrentUser({ fresh: true })
    if (signedIn) await continueAfterSignIn(signedIn)
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
  try {
    await unwrap(useAuthClient().emailOtp.requestPasswordReset({ email: email.value.trim() }))
    // Same message whether or not the account exists (don't reveal registered emails).
    notice.value = t('auth.resetCodeSent')
    resetCode.value = ''
    newPassword.value = ''
    resetStep.value = 'code'
  } catch (e) {
    fail(e)
  } finally {
    pending.value = null
  }
}

async function submitReset() {
  resetMessages()
  pending.value = 'reset'
  const client = useAuthClient()
  const address = email.value.trim()
  try {
    await unwrap(client.emailOtp.resetPassword({ email: address, otp: resetCode.value.trim(), password: newPassword.value }))
    await unwrap(client.signIn.email({ email: address, password: newPassword.value }))
    resetStep.value = 'off'
    const signedIn = await refreshCurrentUser({ fresh: true })
    if (signedIn) await continueAfterSignIn(signedIn)
  } catch (e) {
    fail(e)
  } finally {
    pending.value = null
  }
}

function cancelReset() {
  resetMessages()
  resetStep.value = 'off'
}

// Coming back from a failed or cancelled Google sign-in (?error=… from Neon Auth).
onMounted(() => {
  const code = route.query.error
  if (typeof code !== 'string') return
  if (code !== 'access_denied') {
    console.error('Google sign-in failed:', code)
    error.value = code === 'account_not_linked' ? t('auth.errors.accountExists') : t('auth.errors.generic')
  }
  router.replace({ query: { ...route.query, error: undefined, error_description: undefined } })
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

      <template v-if="resetStep === 'code'">
        <h1 class="mt-6 text-2xl font-bold tracking-tight">{{ $t('auth.resetTitle') }}</h1>
        <i18n-t keypath="auth.resetSubtitle" tag="p" class="mt-1 text-sm text-muted" scope="global">
          <template #email>
            <strong class="font-medium text-fg break-all">{{ email.trim() }}</strong>
          </template>
        </i18n-t>

        <form class="mt-8 space-y-4" @submit.prevent="submitReset">
          <label class="block text-sm font-medium">
            {{ $t('auth.resetCode') }}
            <input
              v-model="resetCode"
              type="text"
              name="code"
              inputmode="numeric"
              autocomplete="one-time-code"
              pattern="\s*\d{6}\s*"
              maxlength="10"
              required
              :disabled="pending !== null"
              :class="inputClass"
            >
          </label>
          <label class="block text-sm font-medium">
            {{ $t('auth.newPassword') }}
            <input
              v-model="newPassword"
              type="password"
              name="new-password"
              autocomplete="new-password"
              :minlength="MIN_PASSWORD_LENGTH"
              required
              :disabled="pending !== null"
              :class="inputClass"
            >
            <span class="mt-1 block text-xs font-normal text-muted">{{ $t('auth.passwordHint', { min: MIN_PASSWORD_LENGTH }) }}</span>
          </label>
          <button
            type="submit"
            class="w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-on-primary transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="pending !== null"
          >
            {{ pending === 'reset' ? $t('auth.pending') : $t('auth.setNewPassword') }}
          </button>
          <button
            type="button"
            class="w-full rounded-lg bg-surface px-4 py-2.5 text-sm font-medium ring-1 ring-line-strong transition hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="pending !== null"
            @click="forgotPassword"
          >
            {{ $t('auth.resendCode') }}
          </button>
        </form>
      </template>

      <template v-else>
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
      </template>

      <p v-if="error" role="alert" class="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger ring-1 ring-danger-line">
        {{ error }}
      </p>
      <p v-if="notice" role="status" class="mt-4 rounded-lg bg-success-soft px-3 py-2 text-sm text-success ring-1 ring-success-line">
        {{ notice }}
      </p>

      <p v-if="resetStep === 'code'" class="mt-8 text-center text-sm text-muted">
        <button type="button" class="font-medium text-fg underline-offset-4 hover:underline" @click="cancelReset">
          {{ $t('auth.backToSignIn') }}
        </button>
      </p>
      <p v-else class="mt-8 text-center text-sm text-muted">
        {{ mode === 'signup' ? $t('auth.haveAccount') : $t('auth.noAccount') }}
        <button type="button" class="font-medium text-fg underline-offset-4 hover:underline" @click="toggleMode">
          {{ mode === 'signup' ? $t('auth.signIn') : $t('auth.signUp') }}
        </button>
      </p>
    </div>
  </main>
</template>
