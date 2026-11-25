<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'site' })

const PAGE_SIZE = 20

const { t, locale } = useI18n()
const localePath = useLocalePath()
const user = useCurrentUser()

useHead({ title: () => t('jobs.list.title') })

const jobs = shallowRef<Job[]>([])
const pageIndex = ref(0)
// cursors[i] is where page i starts (null for the first page). Firestore pages by cursor,
// so pages are reached one step at a time with Previous / Next.
const cursors = shallowRef<(JobCursor | null)[]>([null])
const hasMore = ref(false)
const total = ref<number | null>(null)
const loading = ref(true)
const failed = ref(false)

const listTop = ref<HTMLElement | null>(null)

async function loadPage(index: number) {
  const u = user.value
  if (!u) return
  loading.value = true
  failed.value = false
  try {
    const page = await fetchMyJobs(u, PAGE_SIZE, cursors.value[index] ?? null)
    jobs.value = page.jobs
    hasMore.value = page.hasMore
    pageIndex.value = index
    if (page.cursor) {
      const next = cursors.value.slice(0, index + 1)
      next[index + 1] = page.cursor
      cursors.value = next
    }
  } catch (e) {
    console.error(e)
    failed.value = true
  } finally {
    loading.value = false
  }
}

async function loadCount() {
  const u = user.value
  if (!u) return
  try {
    total.value = await countMyJobs(u)
  } catch (e) {
    // The count is only for the "1–20 of 57" label; the list works without it.
    console.warn(e)
  }
}

// Load once the signed-in user is known.
const started = ref(false)
watch(user, (u) => {
  if (!u || started.value) return
  started.value = true
  loadPage(0)
  loadCount()
}, { immediate: true })

async function goTo(index: number) {
  if (loading.value || index < 0) return
  await loadPage(index)
  if (!failed.value) listTop.value?.scrollIntoView({ block: 'start', behavior: 'smooth' })
}

const pages = computed(() => total.value === null ? null : Math.max(1, Math.ceil(total.value / PAGE_SIZE)))
const rangeFrom = computed(() => pageIndex.value * PAGE_SIZE + 1)
const rangeTo = computed(() => pageIndex.value * PAGE_SIZE + jobs.value.length)

const dateFormat = computed(() => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }))

function formatBudget(budget: NonNullable<Job['budget']>) {
  return new Intl.NumberFormat(locale.value, { style: 'currency', currency: budget.currency, maximumFractionDigits: 0 }).format(budget.amount)
}

// --- Notices, editing and deleting ---

const route = useRoute()
const router = useRouter()

/** One-off success message: after returning from the edit page (?updated=1) or deleting. */
const notice = ref<string | null>(null)
onMounted(() => {
  if (route.query.updated) {
    notice.value = t('jobs.list.updated')
    router.replace({ query: {} })
  }
})

const confirmingId = ref<string | null>(null)
const deletingId = ref<string | null>(null)
const deleteError = ref<{ id: string, message: string } | null>(null)

async function askDelete(job: Job) {
  deleteError.value = null
  confirmingId.value = job.id
  await nextTick()
  document.getElementById(`cancel-delete-${job.id}`)?.focus()
}

async function confirmDelete(job: Job) {
  const u = user.value
  if (!u || deletingId.value) return
  deletingId.value = job.id
  deleteError.value = null
  try {
    await deleteJob(u, job.id)
    notice.value = t('jobs.list.deleted', { title: job.title })
    confirmingId.value = null
    if (total.value !== null) total.value = Math.max(0, total.value - 1)
    // Reload the page so the next job moves up; step back if this page is now empty.
    await loadPage(jobs.value.length === 1 && pageIndex.value > 0 ? pageIndex.value - 1 : pageIndex.value)
  } catch (e) {
    console.error(e)
    deleteError.value = { id: job.id, message: t('jobs.list.errors.delete') }
  } finally {
    deletingId.value = null
  }
}

const primaryButton = 'inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-on-primary transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg'
const actionButton = 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted transition hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-fg disabled:opacity-50'
const pageButton = 'inline-flex items-center gap-1 rounded-lg bg-surface px-3 py-2 text-sm font-medium ring-1 ring-line-strong transition hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-surface'
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
    <!-- `user` is only set in the browser, so nothing user-specific is server-rendered. -->
    <template v-if="user">
      <div ref="listTop" class="flex scroll-mt-24 flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 class="text-3xl font-bold tracking-tight">{{ $t('jobs.list.title') }}</h1>
          <p class="mt-1 text-muted">{{ $t('jobs.list.subtitle') }}</p>
        </div>
        <NuxtLink :to="localePath('/jobs/new')" :class="[primaryButton, 'self-start sm:self-auto']">
          {{ $t('home.cta.postJob') }}
        </NuxtLink>
      </div>

      <p v-if="notice" role="status" class="mt-6 rounded-xl bg-success-soft px-4 py-3 text-sm text-success ring-1 ring-success-line">
        {{ notice }}
      </p>

      <!-- Error -->
      <div v-if="failed" role="alert" class="mt-8 flex flex-col items-start gap-3 rounded-2xl bg-danger-soft p-5 text-sm text-danger ring-1 ring-danger-line sm:flex-row sm:items-center sm:justify-between">
        {{ $t('jobs.list.errors.load') }}
        <button type="button" :class="pageButton" class="text-fg" @click="loadPage(pageIndex)">
          {{ $t('jobs.list.errors.retry') }}
        </button>
      </div>

      <!-- First load -->
      <ul v-else-if="loading && jobs.length === 0" class="mt-8 space-y-3" aria-busy="true">
        <li v-for="n in 3" :key="n" class="animate-pulse rounded-2xl bg-surface p-5 ring-1 ring-line">
          <div class="h-4 w-28 rounded bg-well" />
          <div class="mt-4 h-5 w-2/3 rounded bg-well" />
          <div class="mt-3 h-4 w-full rounded bg-well" />
          <div class="mt-2 h-4 w-1/2 rounded bg-well" />
        </li>
      </ul>

      <!-- Empty -->
      <div v-else-if="jobs.length === 0" class="mt-8 rounded-2xl bg-surface px-6 py-14 text-center ring-1 ring-line">
        <span class="mx-auto flex size-12 items-center justify-center rounded-full bg-well text-muted">
          <svg class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <rect x="3" y="7" width="18" height="13" rx="2" />
            <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 13h18" />
          </svg>
        </span>
        <h2 class="mt-4 text-lg font-semibold">{{ $t('jobs.list.empty.title') }}</h2>
        <p class="mt-1 text-sm text-muted">{{ $t('jobs.list.empty.text') }}</p>
        <NuxtLink :to="localePath('/jobs/new')" :class="[primaryButton, 'mt-6']">{{ $t('home.cta.postJob') }}</NuxtLink>
      </div>

      <!-- List -->
      <template v-else>
        <ul class="mt-8 space-y-3 transition-opacity" :class="loading && 'opacity-60'" :aria-busy="loading">
          <li v-for="job in jobs" :key="job.id" class="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-line sm:p-6">
            <div class="flex items-start justify-between gap-3">
              <ul v-if="job.tags.length" class="flex min-w-0 flex-wrap gap-1.5" :aria-label="$t('jobs.new.fields.tags')">
                <li v-for="tag in job.tags" :key="tag" class="max-w-full truncate rounded-full bg-well px-2.5 py-0.5 text-xs font-medium text-muted">
                  {{ tag }}
                </li>
              </ul>
              <span class="ml-auto shrink-0 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success ring-1 ring-success-line">
                {{ $t(`jobs.list.status.${job.status}`) }}
              </span>
            </div>
            <h2 class="mt-3 text-lg font-semibold break-words">{{ job.title }}</h2>
            <p class="mt-1 line-clamp-2 text-sm break-words whitespace-pre-line text-muted">{{ job.description }}</p>
            <div class="mt-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div class="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                <span class="font-medium">{{ job.budget ? formatBudget(job.budget) : $t('jobs.list.noBudget') }}</span>
                <span v-if="job.location" class="inline-flex items-center gap-1 text-muted">
                  <svg class="size-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {{ job.location.city ? `${job.location.city} · ` : '' }}{{ $t(`jobs.location.${job.location.mode}`) }}
                </span>
                <span v-if="job.createdAt" class="text-subtle">
                  {{ $t('jobs.list.posted', { date: dateFormat.format(job.createdAt) }) }}
                </span>
              </div>
              <div v-if="confirmingId !== job.id" class="-mr-2.5 flex gap-1">
                <NuxtLink
                  :to="localePath(`/jobs/${job.id}/edit`)"
                  :class="[actionButton, 'hover:text-fg']"
                  :aria-label="$t('jobs.list.editJob', { title: job.title })"
                >
                  <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
                    <path d="m13.5 6.5 4 4" />
                  </svg>
                  {{ $t('jobs.list.edit') }}
                </NuxtLink>
                <button
                  type="button"
                  :class="[actionButton, 'hover:text-danger']"
                  :aria-label="$t('jobs.list.deleteJob', { title: job.title })"
                  :disabled="loading"
                  @click="askDelete(job)"
                >
                  <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                    <path d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6" />
                  </svg>
                  {{ $t('jobs.list.delete') }}
                </button>
              </div>
            </div>

            <!-- Inline delete confirmation -->
            <div
              v-if="confirmingId === job.id"
              class="mt-4 flex flex-col gap-3 rounded-xl bg-danger-soft p-3 ring-1 ring-danger-line sm:flex-row sm:items-center sm:justify-between"
            >
              <p class="text-sm text-danger">
                {{ deleteError?.id === job.id ? deleteError.message : $t('jobs.list.confirmDelete') }}
              </p>
              <div class="flex shrink-0 gap-2">
                <button
                  :id="`cancel-delete-${job.id}`"
                  type="button"
                  class="rounded-lg bg-surface px-3 py-1.5 text-sm font-medium ring-1 ring-line-strong transition hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-60"
                  :disabled="deletingId === job.id"
                  @click="confirmingId = null"
                >
                  {{ $t('account.cancel') }}
                </button>
                <button
                  type="button"
                  class="rounded-lg bg-danger px-3 py-1.5 text-sm font-medium text-page transition hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:opacity-60"
                  :disabled="deletingId === job.id"
                  @click="confirmDelete(job)"
                >
                  {{ deletingId === job.id ? $t('auth.pending') : $t('jobs.list.delete') }}
                </button>
              </div>
            </div>
          </li>
        </ul>

        <!-- Pagination (only when there is more than one page) -->
        <nav
          v-if="pageIndex > 0 || hasMore"
          :aria-label="$t('jobs.list.pagination')"
          class="mt-8 flex items-center justify-between gap-4"
        >
          <p class="text-sm text-muted" aria-live="polite">
            <template v-if="total !== null">{{ $t('jobs.list.range', { from: rangeFrom, to: rangeTo, total }) }}</template>
            <span v-if="pages" class="hidden sm:inline"> · {{ $t('jobs.list.page', { page: pageIndex + 1, pages }) }}</span>
          </p>
          <div class="flex gap-2">
            <button type="button" :class="pageButton" :disabled="loading || pageIndex === 0" @click="goTo(pageIndex - 1)">
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m15 18-6-6 6-6" />
              </svg>
              {{ $t('jobs.list.previous') }}
            </button>
            <button type="button" :class="pageButton" :disabled="loading || !hasMore" @click="goTo(pageIndex + 1)">
              {{ $t('jobs.list.next') }}
              <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                <path d="m9 18 6-6-6-6" />
              </svg>
            </button>
          </div>
        </nav>
      </template>
    </template>
  </div>
</template>
