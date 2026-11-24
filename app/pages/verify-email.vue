<script setup lang="ts">
import type { FirebaseError } from 'firebase/app'

// Not using the `auth` middleware: it would send unverified users back here in a loop.
// Signed-out and already-verified users are handled by the watcher below.

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const user = useCurrentUser()

useHead({ title: () => t('verify.title') })

const redirectTo = computed(() => safeRedirect(route.query.redirect, localePath('/')))

const pending = ref<'check' | 'resend' | null>(null)
const error = ref<string | null>(null)
const notice = ref<string | null>(null)

const RESEND_COOLDOWN_S = 60
const cooldown = ref(0)
let cooldownTimer: ReturnType<typeof setInterval> | undefined

function startCooldown() {
  cooldown.value = RESEND_COOLDOWN_S
  clearInterval(cooldownTimer)
  cooldownTimer = setInterval(() => {
    if (--cooldown.value <= 0) clearInterval(cooldownTimer)
  }, 1000)
}

function errorMessage(code: string | undefined) {
  switch (code) {
    case 'auth/too-many-requests':
      return t('auth.errors.tooManyRequests')
    case 'auth/network-request-failed':
      return t('auth.errors.network')
    case 'auth/unauthorized-continue-uri':
    case 'auth/invalid-continue-uri':
      return t('auth.errors.unauthorizedDomain')
    default:
      return t('auth.errors.generic')
  }
}

/** Reloads the user from Firebase; if now verified, refreshes the ID token and continues. */
async function checkVerified({ silent = false } = {}) {
  const u = user.value
  if (!u || pending.value) return
  if (!silent) {
    error.value = null
    notice.value = null
    pending.value = 'check'
  }
  try {
    await u.reload()
    if (u.emailVerified) {
      // Fresh token so `request.auth.token.email_verified` is true in Firestore rules.
      await u.getIdToken(true)
      await navigateTo(redirectTo.value, { replace: true })
    } else if (!silent) {
      error.value = t('verify.notYet')
    }
  } catch (e) {
    console.error(e)
    if (!silent) error.value = errorMessage((e as FirebaseError).code)
  } finally {
    if (!silent) pending.value = null
  }
}

async function resend() {
  const u = user.value
  if (!u || pending.value || cooldown.value > 0) return
  error.value = null
  notice.value = null
  pending.value = 'resend'
  try {
    await sendVerificationEmail(u, redirectTo.value)
    notice.value = t('verify.resent')
    startCooldown()
  } catch (e) {
    console.error(e)
    error.value = errorMessage((e as FirebaseError).code)
  } finally {
    pending.value = null
  }
}

let checkedOnLoad = false
watch(user, (u) => {
  if (u === null) {
    navigateTo(localePath({ path: '/login', query: { redirect: route.fullPath } }), { replace: true })
  } else if (u?.emailVerified) {
    navigateTo(redirectTo.value, { replace: true })
  } else if (u && !checkedOnLoad) {
    // The stored session may predate verification (e.g. arriving from the email link).
    checkedOnLoad = true
    checkVerified({ silent: true })
  }
}, { immediate: true })

// Re-check when the user comes back to this tab after clicking the link in their inbox.
function onVisible() {
  if (document.visibilityState === 'visible') checkVerified({ silent: true })
}
onMounted(() => document.addEventListener('visibilitychange', onVisible))
onBeforeUnmount(() => {
  document.removeEventListener('visibilitychange', onVisible)
  clearInterval(cooldownTimer)
})
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

      <button
        type="button"
        class="mt-8 w-full rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-on-primary transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="pending !== null"
        @click="checkVerified()"
      >
        {{ pending === 'check' ? $t('auth.pending') : $t('verify.continue') }}
      </button>

      <button
        type="button"
        class="mt-3 w-full rounded-lg bg-surface px-4 py-2.5 text-sm font-medium ring-1 ring-line-strong transition hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:cursor-not-allowed disabled:opacity-60"
        :disabled="pending !== null || cooldown > 0"
        @click="resend"
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
