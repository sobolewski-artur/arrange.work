<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'site' })

const PAGE_SIZE = 20

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const router = useRouter()
const user = useCurrentUser()
const { formatBudget, formatLocations, formatDate } = useJobFormat()

useHead({ title: () => t('applications.title') })

// --- Status tab, kept in the URL (?status=accepted); "all" is the default and left out ---

const tabs = ['all', ...APPLICATION_STATUSES] as const
type Tab = typeof tabs[number]

const tab = computed<Tab>(() => {
  const value = String(route.query.status ?? '')
  return (tabs as readonly string[]).includes(value) ? value as Tab : 'all'
})
const statusFilter = computed(() => tab.value === 'all' ? null : tab.value)

function setTab(value: Tab) {
  router.replace({ query: { ...route.query, status: value === 'all' ? undefined : value } })
}

// --- Paged list (cursor pagination, like the job lists) ---

const items = shallowRef<MyApplication[]>([])
const pageIndex = ref(0)
const cursors = shallowRef<(ApplicationCursor | null)[]>([null])
const hasMore = ref(false)
const total = ref<number | null>(null)
const loading = ref(true)
const failed = ref(false)
const listTop = ref<HTMLElement | null>(null)

let latestLoad = 0
let latestCount = 0

async function loadPage(index: number) {
  const u = user.value
  if (!u) return
  const load = ++latestLoad
  loading.value = true
  failed.value = false
  try {
    const page = await fetchMyApplications(u, PAGE_SIZE, cursors.value[index] ?? null, statusFilter.value)
    if (load !== latestLoad) return
    items.value = page.items
    hasMore.value = page.hasMore
    pageIndex.value = index
    if (page.cursor) {
      const next = cursors.value.slice(0, index + 1)
      next[index + 1] = page.cursor
      cursors.value = next
    }
  } catch (e) {
    if (load !== latestLoad) return
    console.error(e)
    failed.value = true
  } finally {
    if (load === latestLoad) loading.value = false
  }
}

async function loadCount() {
  const u = user.value
  if (!u) return
  const load = ++latestCount
  try {
    const count = await countMyApplications(u, statusFilter.value)
    if (load === latestCount) total.value = count
  } catch (e) {
    console.warn(e)
  }
}

function restart() {
  cursors.value = [null]
  pageIndex.value = 0
  total.value = null
  loadPage(0)
  loadCount()
}

const started = ref(false)
watch(user, (u) => {
  if (!u || started.value) return
  started.value = true
  restart()
}, { immediate: true })

watch(tab, () => {
  if (started.value) restart()
})

async function goTo(index: number) {
  if (loading.value || index < 0) return
  await loadPage(index)
  if (!failed.value) listTop.value?.scrollIntoView({ block: 'start', behavior: 'smooth' })
}

const pages = computed(() => total.value === null ? null : Math.max(1, Math.ceil(total.value / PAGE_SIZE)))

const statusBadge: Record<ApplicationStatus, string> = {
  pending: 'bg-well text-muted',
  accepted: 'bg-success-soft text-success ring-1 ring-success-line',
  rejected: 'bg-danger-soft text-danger ring-1 ring-danger-line'
}

const secondaryButton = 'inline-flex items-center gap-1 rounded-lg bg-surface px-3 py-2 text-sm font-medium ring-1 ring-line-strong transition hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg'
const primaryButton = 'inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-on-primary transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg'
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
    <!-- `user` is only set in the browser, so nothing user-specific is server-rendered. -->
    <template v-if="user">
      <div ref="listTop" class="scroll-mt-24">
        <h1 class="text-3xl font-bold tracking-tight">{{ $t('applications.title') }}</h1>
        <p class="mt-1 text-muted">{{ $t('applications.subtitle') }}</p>
      </div>

      <!-- Status tabs -->
      <div role="group" :aria-label="$t('applications.filter')" class="mt-8 -mx-1 overflow-x-auto px-1">
        <div class="inline-flex gap-1 rounded-lg bg-well p-1">
          <button
            v-for="option in tabs"
            :key="option"
            type="button"
            class="rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-fg"
            :class="tab === option ? 'bg-surface text-fg shadow-sm' : 'text-muted hover:text-fg'"
            :aria-pressed="tab === option"
            @click="setTab(option)"
          >
            {{ $t(`applications.tabs.${option}`) }}
          </button>
        </div>
      </div>

      <!-- Error -->
      <div v-if="failed" role="alert" class="mt-6 flex flex-col items-start gap-3 rounded-2xl bg-danger-soft p-5 text-sm text-danger ring-1 ring-danger-line sm:flex-row sm:items-center sm:justify-between">
        {{ $t('applications.errors.load') }}
        <button type="button" :class="secondaryButton" class="text-fg" @click="loadPage(pageIndex)">{{ $t('jobs.list.errors.retry') }}</button>
      </div>

      <!-- First load -->
      <JobListSkeleton v-else-if="loading && items.length === 0" class="mt-6" />

      <!-- Empty -->
      <div v-else-if="items.length === 0" class="mt-6 rounded-2xl bg-surface px-6 py-14 text-center ring-1 ring-line">
        <h2 class="text-lg font-semibold">{{ $t(`applications.empty.${tab}`) }}</h2>
        <p v-if="tab === 'all'" class="mt-1 text-sm text-muted">{{ $t('applications.empty.text') }}</p>
        <NuxtLink v-if="tab === 'all'" :to="localePath('/find-work')" :class="[primaryButton, 'mt-6']">{{ $t('nav.findWork') }}</NuxtLink>
      </div>

      <!-- List -->
      <template v-else>
        <ul class="mt-6 space-y-3 transition-opacity" :class="loading && 'opacity-60'" :aria-busy="loading">
          <li
            v-for="{ jobId, application, job } in items"
            :key="jobId"
            class="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-line sm:p-6"
          >
            <div class="flex items-start justify-between gap-3">
              <h2 class="min-w-0 text-lg font-semibold break-words">
                <NuxtLink
                  v-if="job"
                  :to="localePath(`/jobs/${jobId}`)"
                  class="underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
                >
                  {{ job.title }}
                </NuxtLink>
                <span v-else class="text-muted">{{ $t('applications.jobGone') }}</span>
              </h2>
              <span class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium" :class="statusBadge[application.status]">
                {{ $t(`jobs.details.status.${application.status}`) }}
              </span>
            </div>

            <div v-if="job" class="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted">
              <span>{{ formatBudget(job.budget) }}</span>
              <span v-if="job.locations.length">{{ formatLocations(job.locations) }}</span>
            </div>

            <!-- Clamp an inner element: clamping the padded box itself would show part of the next line. -->
            <blockquote class="mt-3 rounded-xl bg-well px-4 py-3 text-sm">
              <p class="line-clamp-3 break-words whitespace-pre-line">{{ application.message }}</p>
            </blockquote>

            <p class="mt-3 flex flex-wrap gap-x-1.5 text-xs text-subtle">
              <span v-if="application.createdAt">{{ $t('jobs.details.applied.on', { date: formatDate(application.createdAt) }) }}</span>
              <span v-if="application.decidedAt && application.status !== 'pending'">
                {{ $t(`applications.decided.${application.status}`, { date: formatDate(application.decidedAt) }) }}
              </span>
            </p>
          </li>
        </ul>

        <JobPagination
          class="mt-8"
          :page-index="pageIndex"
          :has-more="hasMore"
          :loading="loading"
          :total="total"
          :pages="pages"
          :range-from="pageIndex * PAGE_SIZE + 1"
          :range-to="pageIndex * PAGE_SIZE + items.length"
          @previous="goTo(pageIndex - 1)"
          @next="goTo(pageIndex + 1)"
        />
      </template>
    </template>
  </div>
</template>
