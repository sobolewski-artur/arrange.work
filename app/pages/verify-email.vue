<script setup lang="ts">
// Not using the `auth` middleware: it would send unverified users back here in a loop.
// Signed-out and already-verified users are handled by the watcher below.

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const user = useCurrentUser()

useHead({ title: () => t('verify.title') })

const redirectTo = computed(() => safeRedirect(route.query.redirect, localePath('/')))

const code = ref('')
const pending = ref<'verify' | 'resend' | null>(null)
const error = ref<string | null>(null)
const notice = ref<string | null>(null)
const codeInput = ref<HTMLInputElement | null>(null)

const RESEND_COOLDOWN_S = 60
const cooldown = ref(0)
let cooldownTimer: ReturnType<typeof setInterval> | undefined

function startCooldown(seconds = RESEND_COOLDOWN_S) {
  cooldown.value = seconds
  clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    if (--cooldown.value <= 0) clearInterval(cooldownTimer)
  }, 1000)
}

function errorMessage(e: unknown) {
  if (!(e instanceof AuthFailure)) return t('auth.errors.generic')
  if (e.isNetwork) return t('auth.errors.network')
  if (e.status === 429) return t('auth.errors.tooManyRequests')
  switch (e.code) {
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

const canVerify = computed(() => pending.value === null && /^\d{6}$/.test(code.value.trim()))

/** Checks the code; once verified, continues to where the user was going. */
async function verify() {
  const u = user.value
  if (!u || !canVerify.value) return
  error.value = null
  notice.value = null
  pending.value = 'verify'
  try {
    const updated = await verifyEmailCode(u.email, code.value.trim())
    if (updated?.emailVerified) await navigateTo(redirectTo.value, { replace: true })
    else error.value = t('auth.errors.generic')
  } catch (e) {
    console.error(e)
    error.value = errorMessage(e)
  } finally {
    pending.value = null
  }
}

/** Emails a (new) code. `quiet` skips the "sent" message, for the automatic first send. */
async function resend({ quiet = false } = {}) {
  const u = user.value
  if (!u || pending.value || cooldown.value > 0) return
  error.value = null
  notice.value = null
  pending.value = 'resend'
  try {
    await sendVerificationCode(u.email)
    markVerificationCodeSent(u.email)
    if (!quiet) notice.value = t('verify.resent')
    code.value = ''
    startCooldown()
  } catch (e) {
    console.error(e)
    error.value = errorMessage(e)
  } finally {
    pending.value = null
  }
}

let started = false
watch(user, (u) => {
  if (u === null) {
    navigateTo(localePath({ path: '/login', query: { redirect: route.fullPath } }), { replace: true })
  } else if (u?.emailVerified) {
    navigateTo(redirectTo.value, { replace: true })
  } else if (u && !started) {
    // Sign-up already sent a code; otherwise (e.g. signing in to an unverified account) send one.
    started = true
    const sentAt = verificationCodeSentAt(u.email)
    const elapsed = sentAt ? Math.floor((Date.now() - sentAt.getTime()) / 1000) : Infinity
    if (elapsed < RESEND_COOLDOWN_S) startCooldown(RESEND_COOLDOWN_S - elapsed)
    else resend({ quiet: true })
    nextTick(() => codeInput.value?.focus())
  }
}, { immediate: true })

onBeforeUnmount(() => clearInterval(cooldownTimer))
</script>

<template>
  <main class="min-h-screen flex items-center justify-center bg-page px-4 text-fg">
    <div v-if="user" class="w-full max-w-sm rounded-2xl bg-surface p-8 shadow-sm ring-1 ring-line">
      <NuxtLink :to="localePath('/')" class="text-sm font-semibold tracking-tight text-muted hover:text-fg">
        arrange.work
      </NuxtLink>

      <div class="mt-6 flex size-12 items-center justify-center rounded-full bg-well" aria-hidden="true">
        <svg class="size-6 text-fg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="5" width="18" height="14" rx="2" />
          <path d="m3 7 9 6 9-6" />
        </svg>
      </div>

      <h1 class="mt-4 text-2xl font-bold tracking-tight">{{ $t('verify.title') }}</h1>
      <i18n-t keypath="verify.sentTo" tag="p" class="mt-2 text-sm text-muted" scope="global">
        <template #email>
          <strong class="font-medium text-fg break-all">{{ user.email }}</strong>
        </template>
      </i18n-t>
      <p class="mt-2 text-sm text-muted">{{ $t('verify.spamHint') }}</p>

      <form class="mt-8" @submit.prevent="verify">
        <label for="code" class="text-sm font-medium">{{ $t('verify.codeLabel') }}</label>
        <input
          id="code"
          ref="codeInput"
          v-model="code"
          type="text"
          name="code"
          inputmode="numeric"
          autocomplete="one-time-code"
          maxlength="10"
          :disabled="pending === 'verify'"
          class="mt-1 block w-full rounded-lg bg-surface px-3 py-2 text-center font-mono text-lg tracking-[0.4em] ring-1 ring-line-strong focus:outline-2 focus:outline-offset-0 focus:outline-fg disabled:opacity-60"
        >
        <button
          type="submit"
          class="mt-4 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-on-primary transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:cursor-not-allowed disabled:opacity-60"
          :disabled="!canVerify"
        >
          {{ pending === 'verify' ? $t('auth.pending') : $t('verify.continue') }}
        </button>
      </form>

      <button
        type="button"
        class="mt-3 w-full rounded-lg bg-surface px-4 py-2.5 text-sm font-medium ring-1 ring-line-strong transition hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="pending !== null || cooldown > 0"
        @click="resend()"
      >
        <template v-if="pending === 'resend'">{{ $t('auth.pending') }}</template>
        <template v-else-if="cooldown > 0">{{ $t('verify.resendIn', { s: cooldown }) }}</template>
        <template v-else>{{ $t('verify.resend') }}</template>
      </button>

      <p v-if="error" role="alert" class="mt-4 rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger ring-1 ring-danger-line">
        {{ error }}
      </p>
      <p v-if="notice" role="status" class="mt-4 rounded-lg bg-success-soft px-3 py-2 text-sm text-success ring-1 ring-success-line">
        {{ notice }}
      </p>

      <p class="mt-8 text-center text-sm text-muted">
        {{ $t('verify.wrongAccount') }}
        <button type="button" class="font-medium text-fg underline-offset-4 hover:underline" @click="signOutUser">
          {{ $t('auth.signOut') }}
        </button>
      </p>
    </div>
  </main>
</template>
