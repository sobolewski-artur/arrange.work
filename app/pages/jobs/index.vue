<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'site' })

const { t } = useI18n()
const localePath = useLocalePath()
const route = useRoute()
const router = useRouter()
const user = useCurrentUser()

useHead({ title: () => t('jobs.list.title') })

const list = useJobList({
  scope: () => user.value ? { kind: 'mine', user: user.value } : null,
  onReset: () => { confirmingId.value = null }
})
const { jobs, pageIndex, loading, failed, filterTags, filterActive, filterDraft, sort } = list

const listTop = ref<HTMLElement | null>(null)

// --- Notices, editing and deleting ---

/** One-off success message: after returning from the edit page (?updated=1) or deleting. */
const notice = ref<string | null>(null)
onMounted(() => {
  if (route.query.updated) {
    notice.value = t('jobs.list.updated')
    router.replace({ query: { ...route.query, updated: undefined } })
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
  if (deletingId.value) return
  deletingId.value = job.id
  deleteError.value = null
  try {
    await deleteJob(job.id)
    notice.value = t('jobs.list.deleted', { title: job.title })
    confirmingId.value = null
    await list.afterRemove()
  } catch (e) {
    console.error(e)
    deleteError.value = { id: job.id, message: t('jobs.list.errors.delete') }
  } finally {
    deletingId.value = null
  }
}

const primaryButton = 'inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-on-primary transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg'
const secondaryButton = 'inline-flex items-center gap-1 rounded-lg bg-surface px-3 py-2 text-sm font-medium ring-1 ring-line-strong transition hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg'
const actionButton = 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted transition hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-fg disabled:opacity-50'
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

      <!-- Tag filter and sort (hidden only while the user has no jobs at all) -->
      <JobListControls
        v-if="filterActive || jobs.length > 0 || pageIndex > 0"
        v-model:filter="filterDraft"
        class="mt-8"
        :sort="sort"
        @update:sort="list.setSort"
      />

      <p v-if="notice" role="status" class="mt-6 rounded-xl bg-success-soft px-4 py-3 text-sm text-success ring-1 ring-success-line">
        {{ notice }}
      </p>

      <!-- Error -->
      <div v-if="failed" role="alert" class="mt-8 flex flex-col items-start gap-3 rounded-2xl bg-danger-soft p-5 text-sm text-danger ring-1 ring-danger-line sm:flex-row sm:items-center sm:justify-between">
        {{ $t('jobs.list.errors.load') }}
        <button type="button" :class="secondaryButton" class="text-fg" @click="list.loadPage(pageIndex)">
          {{ $t('jobs.list.errors.retry') }}
        </button>
      </div>

      <!-- First load -->
      <JobListSkeleton v-else-if="loading && jobs.length === 0" class="mt-8" />

      <!-- Nothing matches the filter -->
      <div v-else-if="jobs.length === 0 && filterActive" class="mt-8 rounded-2xl bg-surface px-6 py-14 text-center ring-1 ring-line">
        <h2 class="text-lg font-semibold">{{ $t('jobs.list.filter.empty.title') }}</h2>
        <p class="mt-1 text-sm text-muted">{{ $t('jobs.list.filter.empty.text') }}</p>
        <button type="button" :class="[secondaryButton, 'mt-6']" @click="filterDraft = []">{{ $t('jobs.list.filter.clear') }}</button>
      </div>

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
          <JobCard
            v-for="job in jobs"
            :key="job.id"
            :job="job"
            :active-tags="filterTags"
            @toggle-tag="list.toggleFilterTag"
          >
            <template #actions>
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
            </template>

            <!-- Inline delete confirmation -->
            <template #footer>
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
            </template>
          </JobCard>
        </ul>

        <JobPagination
          class="mt-8"
          :page-index="pageIndex"
          :has-more="list.hasMore.value"
          :loading="loading"
          :total="list.total.value"
          :pages="list.pages.value"
          :range-from="list.rangeFrom.value"
          :range-to="list.rangeTo.value"
          @previous="list.goTo(pageIndex - 1, listTop)"
          @next="list.goTo(pageIndex + 1, listTop)"
        />
      </template>
    </template>
  </div>
</template>
