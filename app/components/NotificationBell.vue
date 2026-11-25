<script setup lang="ts">
import type { Unsubscribe } from 'firebase/firestore'

/**
 * Bell with an unread count and a dropdown of notifications: new applications to the user's
 * jobs, and decisions on their own applications. Opening the dropdown marks everything as
 * seen. Render only for a signed-in user.
 */
const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const user = useCurrentUser()
const { formatRelative } = useJobFormat()

const notifications = shallowRef<AppNotification[]>([])
const seenAt = ref<Date | null>(null)
const failed = ref(false)

// Live listeners, (re)started whenever the signed-in user changes.
let stops: Unsubscribe[] = []
function stopListening() {
  stops.forEach(stop => stop())
  stops = []
}
watch(user, (u) => {
  stopListening()
  notifications.value = []
  seenAt.value = null
  if (!u) return
  stops = [
    watchNotifications(u, (list) => {
      notifications.value = list
      failed.value = false
    }, (e) => {
      console.warn('Could not load notifications', e)
      failed.value = true
    }),
    watchNotificationsSeenAt(u, (date) => { seenAt.value = date })
  ]
}, { immediate: true })
onBeforeUnmount(stopListening)

function isUnread(n: AppNotification, since: Date | null) {
  return !since || (n.at !== null && n.at > since)
}

const kindIcon: Record<NotificationKind, string> = {
  applied: 'bg-well text-muted',
  accepted: 'bg-success-soft text-success',
  rejected: 'bg-danger-soft text-danger'
}

const unreadCount = computed(() => notifications.value.filter(n => isUnread(n, seenAt.value)).length)
const badge = computed(() => unreadCount.value > 9 ? '9+' : String(unreadCount.value))

// --- Dropdown ---

const root = ref<HTMLElement | null>(null)
const button = ref<HTMLButtonElement | null>(null)
const open = ref(false)
/** "Seen" time from before the dropdown was opened, so unread items stay highlighted while it's open. */
const highlightSince = ref<Date | null>(null)

function toggle() {
  if (open.value) return close()
  highlightSince.value = seenAt.value
  open.value = true
  const u = user.value
  if (u && unreadCount.value > 0) markNotificationsSeen(u).catch(e => console.warn(e))
}

function close({ focusButton = false } = {}) {
  if (!open.value) return
  open.value = false
  if (focusButton) button.value?.focus()
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape') close({ focusButton: true })
}
function onPointerDown(event: PointerEvent) {
  if (root.value && !root.value.contains(event.target as Node)) close()
}
watch(open, (isOpen) => {
  const method = isOpen ? 'addEventListener' : 'removeEventListener'
  document[method]('keydown', onKeydown)
  document[method]('pointerdown', onPointerDown)
})
onBeforeUnmount(() => close())
watch(() => route.fullPath, () => close())

const buttonLabel = computed(() => unreadCount.value
  ? t('notifications.labelUnread', { count: unreadCount.value })
  : t('notifications.label'))
</script>

<template>
  <div ref="root" class="relative">
    <button
      ref="button"
      type="button"
      class="relative flex size-10 items-center justify-center rounded-lg text-fg transition hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-fg"
      :aria-label="buttonLabel"
      :aria-expanded="open"
      aria-controls="notifications-panel"
      @click="toggle"
    >
      <svg class="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
        <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
      </svg>
      <span
        v-if="unreadCount > 0"
        class="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] leading-none font-semibold text-page"
        aria-hidden="true"
      >
        {{ badge }}
      </span>
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out motion-reduce:transition-none"
      enter-from-class="-translate-y-1 opacity-0"
      leave-active-class="transition duration-100 ease-in motion-reduce:transition-none"
      leave-to-class="-translate-y-1 opacity-0"
    >
      <!-- Full width under the header on phones, a dropdown under the bell from sm up. -->
      <div
        v-show="open"
        id="notifications-panel"
        class="fixed inset-x-4 top-16 z-30 overflow-hidden rounded-2xl bg-surface shadow-lg ring-1 ring-line sm:absolute sm:inset-x-auto sm:top-full sm:right-0 sm:mt-2 sm:w-96"
      >
        <div class="border-b border-line px-4 py-3">
          <h2 class="text-sm font-semibold">{{ $t('notifications.title') }}</h2>
        </div>

        <!-- One of the two feeds can fail (e.g. while an index builds); show what loaded. -->
        <p v-if="failed" class="border-b border-line px-4 py-3 text-sm text-danger">{{ $t('notifications.error') }}</p>
        <p v-if="notifications.length === 0 && !failed" class="px-4 py-8 text-center text-sm text-muted">{{ $t('notifications.empty') }}</p>
        <ul v-if="notifications.length > 0" class="max-h-[min(24rem,calc(100dvh-8rem))] divide-y divide-line overflow-y-auto">
          <li v-for="n in notifications" :key="n.id">
            <NuxtLink
              :to="localePath(`/jobs/${n.jobId}`)"
              class="flex gap-3 px-4 py-3 text-sm transition-colors hover:bg-hover focus-visible:bg-hover focus-visible:outline-none"
              :class="isUnread(n, highlightSince) && 'bg-well/60'"
            >
              <span
                class="mt-1.5 size-2 shrink-0 rounded-full"
                :class="isUnread(n, highlightSince) ? 'bg-danger' : 'bg-transparent'"
                aria-hidden="true"
              />
              <span class="flex size-7 shrink-0 items-center justify-center rounded-full" :class="kindIcon[n.kind]" aria-hidden="true">
                <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path v-if="n.kind === 'accepted'" d="M20 6 9 17l-5-5" />
                  <path v-else-if="n.kind === 'rejected'" d="M18 6 6 18M6 6l12 12" />
                  <template v-else>
                    <circle cx="12" cy="8" r="4" />
                    <path d="M4 21v-1a6 6 0 0 1 12 0v1M19 8v6M16 11h6" />
                  </template>
                </svg>
              </span>
              <span class="min-w-0">
                <span class="block break-words">
                  <i18n-t v-if="n.kind === 'applied'" keypath="notifications.applied" scope="global">
                    <template #name><strong class="font-semibold">{{ n.name }}</strong></template>
                    <template #job><strong class="font-semibold">{{ n.jobTitle }}</strong></template>
                  </i18n-t>
                  <i18n-t v-else-if="n.jobTitle" :keypath="`notifications.${n.kind}`" scope="global">
                    <template #job><strong class="font-semibold">{{ n.jobTitle }}</strong></template>
                  </i18n-t>
                  <template v-else>{{ $t(`notifications.${n.kind}NoTitle`) }}</template>
                </span>
                <span v-if="n.at" class="mt-0.5 block text-xs text-subtle">{{ formatRelative(n.at) }}</span>
                <span v-if="isUnread(n, highlightSince)" class="sr-only">{{ $t('notifications.unread') }}</span>
              </span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </Transition>
  </div>
</template>
