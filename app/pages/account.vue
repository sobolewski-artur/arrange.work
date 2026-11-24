<script setup lang="ts">
import type { FirebaseError } from 'firebase/app'
import { updateProfile } from 'firebase/auth'

definePageMeta({ middleware: 'auth' })

const { t } = useI18n()
const localePath = useLocalePath()
const user = useCurrentUser()

useHead({ title: () => t('account.title') })

const displayName = ref('')
const saving = ref(false)
const error = ref<string | null>(null)
const saved = ref(false)

// Keep the field in sync with the stored name (initial load, or a change in another tab).
watch(() => user.value?.displayName, (name) => {
  displayName.value = name ?? ''
}, { immediate: true })

const trimmed = computed(() => displayName.value.trim())
const canSave = computed(() =>
  !saving.value && trimmed.value.length > 0 && trimmed.value !== (user.value?.displayName ?? '')
)

watch(displayName, () => {
  saved.value = false
  error.value = null
})

async function saveDisplayName() {
  const u = user.value
  if (!u || !canSave.value) return
  saving.value = true
  error.value = null
  saved.value = false
  try {
    await updateProfile(u, { displayName: trimmed.value })
    refreshCurrentUser()
    saved.value = true
  } catch (e) {
    console.error(e)
    const code = (e as FirebaseError).code
    error.value = code === 'auth/network-request-failed'
      ? t('auth.errors.network')
      : code === 'auth/too-many-requests'
        ? t('auth.errors.tooManyRequests')
        : t('account.errors.saveFailed')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <main class="min-h-screen flex items-center justify-center bg-slate-50 px-4 text-slate-900">
    <!-- `user` is only set in the browser, so nothing user-specific is server-rendered. -->
    <div v-if="user" class="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm ring-1 ring-slate-200">
      <NuxtLink :to="localePath('/')" class="text-sm text-slate-500 hover:text-slate-900">
        ← {{ $t('account.back') }}
      </NuxtLink>

      <div class="mt-6 flex items-center gap-4">
        <img
          v-if="user.photoURL"
          :src="user.photoURL"
          alt=""
          referrerpolicy="no-referrer"
          class="size-14 rounded-full"
        >
        <div class="min-w-0">
          <h1 class="truncate text-xl font-bold tracking-tight">{{ user.displayName || user.email }}</h1>
          <p class="truncate text-sm text-slate-500">{{ user.email }}</p>
        </div>
      </div>

      <form class="mt-8 border-t border-slate-200 pt-6" @submit.prevent="saveDisplayName">
        <label for="displayName" class="block text-sm font-medium">{{ $t('auth.displayName') }}</label>
        <div class="mt-1 flex gap-2">
          <input
            id="displayName"
            v-model="displayName"
            type="text"
            name="name"
            autocomplete="name"
            required
            pattern=".*\S.*"
            :maxlength="MAX_DISPLAY_NAME_LENGTH"
            :title="$t('auth.errors.missingDisplayName')"
            :disabled="saving"
            class="block w-full min-w-0 rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-slate-300 focus:outline-2 focus:outline-offset-0 focus:outline-slate-900 disabled:opacity-60"
          >
          <button
            type="submit"
            class="shrink-0 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!canSave"
          >
            {{ saving ? $t('auth.pending') : $t('account.save') }}
          </button>
        </div>
        <p v-if="saved" role="status" class="mt-2 text-sm text-emerald-700">{{ $t('account.saved') }}</p>
        <p v-if="error" role="alert" class="mt-2 text-sm text-red-700">{{ error }}</p>
      </form>

      <button
        type="button"
        class="mt-8 w-full rounded-lg bg-white px-4 py-2.5 text-sm font-medium ring-1 ring-slate-300 transition hover:bg-slate-50"
        @click="signOutUser"
      >
        {{ $t('auth.signOut') }}
      </button>
    </div>
  </main>
</template>
