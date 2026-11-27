<script setup lang="ts">
definePageMeta({ middleware: 'auth', layout: 'site' })

const { t } = useI18n()
const localePath = useLocalePath()
const user = useCurrentUser()

useHead({ title: () => t('jobs.browse.title') })

// Every open job, from all clients (including the user's own, which get a badge).
const list = useJobList({ scope: () => user.value ? { kind: 'open' } : null })
const { jobs, pageIndex, loading, failed, filterTags, filterActive, filterDraft, placeDraft, sort } = list

const listTop = ref<HTMLElement | null>(null)

const secondaryButton = 'inline-flex items-center gap-1 rounded-lg bg-surface px-3 py-2 text-sm font-medium ring-1 ring-line-strong transition hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg'
const actionButton = 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-sm font-medium text-muted transition hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-fg'
</script>

<template>
  <div class="mx-auto max-w-4xl px-4 py-12 sm:px-6 sm:py-16">
    <!-- `user` is only set in the browser, so nothing user-specific is server-rendered. -->
    <template v-if="user">
      <div ref="listTop" class="scroll-mt-24">
        <h1 class="text-3xl font-bold tracking-tight">{{ $t('jobs.browse.title') }}</h1>
        <p class="mt-1 text-muted">{{ $t('jobs.browse.subtitle') }}</p>
      </div>

      <JobListControls
        v-if="filterActive || jobs.length > 0 || pageIndex > 0"
        v-model:filter="filterDraft"
        v-model:place="placeDraft"
        show-locations
        class="mt-8"
        :sort="sort"
        @update:sort="list.setSort"
      />

      <!-- Error -->
      <div v-if="failed" role="alert" class="mt-8 flex flex-col items-start gap-3 rounded-2xl bg-danger-soft p-5 text-sm text-danger ring-1 ring-danger-line sm:flex-row sm:items-center sm:justify-between">
        {{ $t('jobs.browse.errors.load') }}
        <button type="button" :class="secondaryButton" class="text-fg" @click="list.loadPage(pageIndex)">
          {{ $t('jobs.list.errors.retry') }}
        </button>
      </div>

      <!-- First load -->
      <JobListSkeleton v-else-if="loading && jobs.length === 0" class="mt-8" />

      <!-- Nothing matches the filter -->
      <div v-else-if="jobs.length === 0 && filterActive" class="mt-8 rounded-2xl bg-surface px-6 py-14 text-center ring-1 ring-line">
        <h2 class="text-lg font-semibold">{{ $t('jobs.browse.emptyFiltered.title') }}</h2>
        <p class="mt-1 text-sm text-muted">{{ $t('jobs.browse.emptyFiltered.text') }}</p>
        <button type="button" :class="[secondaryButton, 'mt-6']" @click="list.clearFilters">{{ $t('jobs.browse.emptyFiltered.clear') }}</button>
      </div>

      <!-- No open jobs at all -->
      <div v-else-if="jobs.length === 0" class="mt-8 rounded-2xl bg-surface px-6 py-14 text-center ring-1 ring-line">
        <span class="mx-auto flex size-12 items-center justify-center rounded-full bg-well text-muted">
          <svg class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
        </span>
        <h2 class="mt-4 text-lg font-semibold">{{ $t('jobs.browse.empty.title') }}</h2>
        <p class="mt-1 text-sm text-muted">{{ $t('jobs.browse.empty.text') }}</p>
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
            <template v-if="job.owner === user.uid" #badges>
              <span class="rounded-full bg-well px-2.5 py-0.5 text-xs font-medium text-muted">{{ $t('jobs.browse.yourJob') }}</span>
            </template>
            <template v-if="job.owner === user.uid" #actions>
              <NuxtLink
                :to="localePath(`/jobs/${job.id}/edit`)"
                :class="[actionButton, '-mr-2.5']"
                :aria-label="$t('jobs.list.editJob', { title: job.title })"
              >
                <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                  <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
                  <path d="m13.5 6.5 4 4" />
                </svg>
                {{ $t('jobs.list.edit') }}
              </NuxtLink>
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
