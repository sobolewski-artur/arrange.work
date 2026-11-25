<script setup lang="ts">
import type { FirebaseError } from 'firebase/app'
import { updateProfile } from 'firebase/auth'

definePageMeta({ middleware: 'auth', layout: 'site' })

const { t } = useI18n()
const user = useCurrentUser()

useHead({ title: () => t('account.title') })

// One message line shared by the photo and display-name actions.
const status = ref<string | null>(null)
const error = ref<string | null>(null)

function clearMessages() {
  status.value = null
  error.value = null
}

const initial = computed(() => (user.value?.displayName || user.value?.email || '?').trim().charAt(0).toUpperCase())

// --- Display name (edited in place) ---

const editing = ref(false)
const displayName = ref('')
const saving = ref(false)
const nameInput = ref<HTMLInputElement | null>(null)
const editButton = ref<HTMLButtonElement | null>(null)

const trimmed = computed(() => displayName.value.trim())
const canSave = computed(() =>
  !saving.value && trimmed.value.length > 0 && trimmed.value !== (user.value?.displayName ?? '')
)

async function startEdit() {
  clearMessages()
  displayName.value = user.value?.displayName ?? ''
  editing.value = true
  await nextTick()
  nameInput.value?.focus()
  nameInput.value?.select()
}

async function stopEdit() {
  editing.value = false
  await nextTick()
  editButton.value?.focus()
}

async function saveDisplayName() {
  const u = user.value
  if (!u || !canSave.value) return
  saving.value = true
  clearMessages()
  try {
    await updateProfile(u, { displayName: trimmed.value })
    refreshCurrentUser()
    status.value = t('account.saved')
    await stopEdit()
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
  clearMessages()
  try {
    await action(u)
    status.value = successMessage
  } catch (e) {
    console.error(e)
    error.value = photoErrorMessage(e)
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

const iconButton = 'flex size-8 shrink-0 items-center justify-center rounded-md text-muted transition hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-fg disabled:cursor-not-allowed disabled:opacity-50'
</script>

<template>
  <div class="flex justify-center px-4 py-12 sm:py-16">
    <!-- `user` is only set in the browser, so nothing user-specific is server-rendered. -->
    <div v-if="user" class="w-full max-w-md rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-line sm:p-8">
      <h1 class="sr-only">{{ $t('account.title') }}</h1>

      <div class="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <!-- Picture with a change button on its corner -->
        <div class="relative size-20 shrink-0" :aria-busy="photoBusy">
          <img
            v-if="user.photoURL"
            :src="user.photoURL"
            alt=""
            referrerpolicy="no-referrer"
            class="size-20 rounded-full object-cover ring-1 ring-line"
          >
          <div
            v-else
            aria-hidden="true"
            class="flex size-20 items-center justify-center rounded-full bg-well text-2xl font-semibold text-muted"
          >
            {{ initial }}
          </div>
          <div v-if="photoBusy" class="absolute inset-0 flex items-center justify-center rounded-full bg-page/60">
            <span class="size-6 animate-spin rounded-full border-2 border-fg border-t-transparent" />
          </div>
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            class="sr-only"
            tabindex="-1"
            aria-hidden="true"
            @change="onPhotoSelected"
          >
          <button
            type="button"
            :aria-label="user.photoURL ? $t('account.changePhoto') : $t('account.uploadPhoto')"
            :title="$t('account.photoHint', { max: MAX_AVATAR_SOURCE_MB })"
            :disabled="photoBusy"
            class="absolute -right-1 -bottom-1 flex size-8 items-center justify-center rounded-full bg-surface text-fg shadow-sm ring-1 ring-line-strong transition hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:cursor-not-allowed disabled:opacity-60"
            @click="fileInput?.click()"
          >
            <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
              <path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3Z" />
              <circle cx="12" cy="13" r="3" />
            </svg>
          </button>
        </div>

        <div class="w-full min-w-0 sm:flex-1">
          <!-- Display name, edited in place -->
          <form
            v-if="editing"
            class="flex items-center gap-1"
            @submit.prevent="saveDisplayName"
            @keydown.esc.prevent="stopEdit"
          >
            <label for="displayName" class="sr-only">{{ $t('auth.displayName') }}</label>
            <input
              id="displayName"
              ref="nameInput"
              v-model="displayName"
              type="text"
              name="name"
              autocomplete="name"
              required
              pattern=".*\S.*"
              :maxlength="MAX_DISPLAY_NAME_LENGTH"
              :title="$t('auth.errors.missingDisplayName')"
              :disabled="saving"
              class="block w-full min-w-0 rounded-lg bg-surface px-2.5 py-1.5 text-base font-semibold ring-1 ring-line-strong focus:outline-2 focus:outline-offset-0 focus:outline-fg disabled:opacity-60"
            >
            <button type="submit" :class="iconButton" :disabled="!canSave" :aria-label="$t('account.save')" :title="$t('account.save')">
              <span v-if="saving" class="size-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
              <svg v-else class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M20 6 9 17l-5-5" />
              </svg>
            </button>
            <button type="button" :class="iconButton" :disabled="saving" :aria-label="$t('account.cancel')" :title="$t('account.cancel')" @click="stopEdit">
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M18 6 6 18M6 6l12 12" />
              </svg>
            </button>
          </form>
          <div v-else class="flex min-w-0 items-center justify-center gap-1 sm:justify-start">
            <p class="truncate text-xl font-bold tracking-tight">{{ user.displayName || user.email }}</p>
            <button
              ref="editButton"
              type="button"
              :class="iconButton"
              :aria-label="$t('account.editName')"
              :title="$t('account.editName')"
              @click="startEdit"
            >
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
                <path d="m13.5 6.5 4 4" />
              </svg>
            </button>
          </div>

          <p class="truncate text-sm text-muted">{{ user.email }}</p>
          <button
            v-if="user.photoURL"
            type="button"
            class="mt-1 text-xs text-muted underline-offset-2 transition hover:text-danger hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-60"
            :disabled="photoBusy"
            @click="removePhoto"
          >
            {{ $t('account.removePhoto') }}
          </button>
        </div>
      </div>

      <p v-if="status" role="status" class="mt-5 text-center text-sm text-success sm:text-left">{{ status }}</p>
      <p v-if="error" role="alert" class="mt-5 text-center text-sm text-danger sm:text-left">{{ error }}</p>

      <button
        type="button"
        class="mt-6 w-full rounded-lg bg-surface px-4 py-2.5 text-sm font-medium ring-1 ring-line-strong transition hover:bg-hover"
        @click="signOutUser"
      >
        {{ $t('auth.signOut') }}
      </button>
    </div>
  </div>
</template>
