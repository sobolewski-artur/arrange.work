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

// --- Profile photo ---

const fileInput = ref<HTMLInputElement | null>(null)
const photoBusy = ref(false)
const photoError = ref<string | null>(null)
const photoStatus = ref<string | null>(null)

const initial = computed(() => (user.value?.displayName || user.value?.email || '?').trim().charAt(0).toUpperCase())

function photoErrorMessage(e: unknown) {
  if (e instanceof AvatarFileError) {
    return e.reason === 'tooLarge'
      ? t('account.errors.photoTooLarge', { max: MAX_AVATAR_SOURCE_MB })
      : t('account.errors.photoUnreadable')
  }
  const code = (e as FirebaseError).code
  return code === 'auth/network-request-failed' || code === 'storage/retry-limit-exceeded'
    ? t('auth.errors.network')
    : code === 'auth/too-many-requests'
      ? t('auth.errors.tooManyRequests')
      : t('account.errors.photoFailed')
}

async function runPhotoAction(action: (u: NonNullable<typeof user.value>) => Promise<void>, successMessage: string) {
  const u = user.value
  if (!u || photoBusy.value) return
  photoBusy.value = true
  photoError.value = null
  photoStatus.value = null
  try {
    await action(u)
    photoStatus.value = successMessage
  } catch (e) {
    console.error(e)
    photoError.value = photoErrorMessage(e)
  } finally {
    photoBusy.value = false
  }
}

function onPhotoSelected(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  // Reset so picking the same file again still fires `change`.
  input.value = ''
  if (file) runPhotoAction(u => uploadAvatar(u, file), t('account.photoSaved'))
}

function removePhoto() {
  runPhotoAction(removeAvatar, t('account.photoRemoved'))
}
</script>

<template>
  <main class="min-h-screen flex items-center justify-center bg-page px-4 text-fg">
    <!-- `user` is only set in the browser, so nothing user-specific is server-rendered. -->
    <div v-if="user" class="w-full max-w-md rounded-2xl bg-surface p-8 shadow-sm ring-1 ring-line">
      <NuxtLink :to="localePath('/')" class="text-sm text-muted hover:text-fg">
        ← {{ $t('account.back') }}
      </NuxtLink>

      <div class="mt-6 flex items-center gap-4">
        <div class="relative size-14 shrink-0">
          <img
            v-if="user.photoURL"
            :src="user.photoURL"
            alt=""
            referrerpolicy="no-referrer"
            class="size-14 rounded-full object-cover"
          >
          <div
            v-else
            aria-hidden="true"
            class="flex size-14 items-center justify-center rounded-full bg-well text-xl font-semibold text-muted"
          >
            {{ initial }}
          </div>
          <div v-if="photoBusy" class="absolute inset-0 flex items-center justify-center rounded-full bg-page/60">
            <span class="size-5 animate-spin rounded-full border-2 border-fg border-t-transparent" />
          </div>
        </div>
        <div class="min-w-0">
          <h1 class="truncate text-xl font-bold tracking-tight">{{ user.displayName || user.email }}</h1>
          <p class="truncate text-sm text-muted">{{ user.email }}</p>
        </div>
      </div>

      <section class="mt-8 border-t border-line pt-6" :aria-busy="photoBusy">
        <h2 class="text-sm font-medium">{{ $t('account.photo') }}</h2>
        <input
          ref="fileInput"
          type="file"
          accept="image/*"
          class="sr-only"
          tabindex="-1"
          aria-hidden="true"
          @change="onPhotoSelected"
        >
        <div class="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            class="rounded-lg bg-surface px-4 py-2 text-sm font-medium ring-1 ring-line-strong transition hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="photoBusy"
            @click="fileInput?.click()"
          >
            {{ photoBusy ? $t('auth.pending') : user.photoURL ? $t('account.changePhoto') : $t('account.uploadPhoto') }}
          </button>
          <button
            v-if="user.photoURL"
            type="button"
            class="rounded-lg px-4 py-2 text-sm font-medium text-danger transition hover:bg-danger-soft focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="photoBusy"
            @click="removePhoto"
          >
            {{ $t('account.removePhoto') }}
          </button>
        </div>
        <p class="mt-2 text-xs text-muted">{{ $t('account.photoHint', { max: MAX_AVATAR_SOURCE_MB }) }}</p>
        <p v-if="photoStatus" role="status" class="mt-2 text-sm text-success">{{ photoStatus }}</p>
        <p v-if="photoError" role="alert" class="mt-2 text-sm text-danger">{{ photoError }}</p>
      </section>

      <form class="mt-6 border-t border-line pt-6" @submit.prevent="saveDisplayName">
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
            class="block w-full min-w-0 rounded-lg bg-surface px-3 py-2 text-sm ring-1 ring-line-strong focus:outline-2 focus:outline-offset-0 focus:outline-fg disabled:opacity-60"
          >
          <button
            type="submit"
            class="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-on-primary transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:cursor-not-allowed disabled:opacity-60"
            :disabled="!canSave"
          >
            {{ saving ? $t('auth.pending') : $t('account.save') }}
          </button>
        </div>
        <p v-if="saved" role="status" class="mt-2 text-sm text-success">{{ $t('account.saved') }}</p>
        <p v-if="error" role="alert" class="mt-2 text-sm text-danger">{{ error }}</p>
      </form>

      <button
        type="button"
        class="mt-8 w-full rounded-lg bg-surface px-4 py-2.5 text-sm font-medium ring-1 ring-line-strong transition hover:bg-hover"
        @click="signOutUser"
      >
        {{ $t('auth.signOut') }}
      </button>
    </div>
  </main>
</template>
