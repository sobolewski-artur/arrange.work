<script setup lang="ts">
/** Previous / Next bar with a "21–40 of 57 · Page 2 of 3" label. Hidden when there's one page. */
defineProps<{
  pageIndex: number
  hasMore: boolean
  loading: boolean
  total: number | null
  pages: number | null
  rangeFrom: number
  rangeTo: number
}>()
defineEmits<{ previous: [], next: [] }>()

const pageButton = 'inline-flex items-center gap-1 rounded-lg bg-surface px-3 py-2 text-sm font-medium ring-1 ring-line-strong transition hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-surface'
</script>

<template>
  <nav
    v-if="pageIndex > 0 || hasMore"
    :aria-label="$t('jobs.list.pagination')"
    class="flex items-center justify-between gap-4"
  >
    <p class="text-sm text-muted" aria-live="polite">
      <template v-if="total !== null">{{ $t('jobs.list.range', { from: rangeFrom, to: rangeTo, total }) }}</template>
      <span v-if="pages" class="hidden sm:inline"> · {{ $t('jobs.list.page', { page: pageIndex + 1, pages }) }}</span>
    </p>
    <div class="flex gap-2">
      <button type="button" :class="pageButton" :disabled="loading || pageIndex === 0" @click="$emit('previous')">
        <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m15 18-6-6 6-6" />
        </svg>
        {{ $t('jobs.list.previous') }}
      </button>
      <button type="button" :class="pageButton" :disabled="loading || !hasMore" @click="$emit('next')">
        {{ $t('jobs.list.next') }}
        <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <path d="m9 18 6-6-6-6" />
        </svg>
      </button>
    </div>
  </nav>
</template>
