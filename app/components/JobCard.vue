<script setup lang="ts">
/**
 * One job in a list. Tags are buttons that toggle themselves in the list's tag filter.
 * Slots: `badges` (extra badges next to the status), `actions` (bottom right) and
 * `footer` (below everything, e.g. a delete confirmation).
 */
const props = defineProps<{
  job: Job
  /** Tags currently in the filter; shown highlighted. */
  activeTags: string[]
}>()

defineEmits<{ toggleTag: [tag: string] }>()

const { locale } = useI18n()

const dateFormat = computed(() => new Intl.DateTimeFormat(locale.value, { dateStyle: 'medium' }))

function formatBudget(budget: NonNullable<Job['budget']>) {
  return new Intl.NumberFormat(locale.value, { style: 'currency', currency: budget.currency, maximumFractionDigits: 0 }).format(budget.amount)
}

// Long descriptions show two lines with a "Show more" toggle.
const expanded = ref(false)
const longDescription = computed(() => props.job.description.length > 160 || props.job.description.split('\n').length > 2)
const descriptionId = computed(() => `job-description-${props.job.id}`)
</script>

<template>
  <li class="rounded-2xl bg-surface p-5 shadow-sm ring-1 ring-line sm:p-6">
    <div class="flex items-start justify-between gap-3">
      <ul v-if="job.tags.length" class="flex min-w-0 flex-wrap gap-1.5" :aria-label="$t('jobs.new.fields.tags')">
        <li v-for="tag in job.tags" :key="tag" class="min-w-0 max-w-full">
          <button
            type="button"
            class="max-w-full truncate rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-fg"
            :class="activeTags.includes(tag) ? 'bg-primary text-on-primary' : 'bg-well text-muted hover:bg-hover hover:text-fg'"
            :aria-pressed="activeTags.includes(tag)"
            :title="$t('jobs.list.filter.byTag', { tag })"
            @click="$emit('toggleTag', tag)"
          >
            {{ tag }}
          </button>
        </li>
      </ul>
      <div class="ml-auto flex shrink-0 items-center gap-1.5">
        <slot name="badges" />
        <span class="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success ring-1 ring-success-line">
          {{ $t(`jobs.list.status.${job.status}`) }}
        </span>
      </div>
    </div>

    <h2 class="mt-3 text-lg font-semibold break-words">{{ job.title }}</h2>
    <p
      :id="descriptionId"
      class="mt-1 text-sm break-words whitespace-pre-line text-muted"
      :class="!expanded && 'line-clamp-2'"
    >{{ job.description }}</p>
    <button
      v-if="longDescription"
      type="button"
      class="mt-1 text-sm font-medium underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg"
      :aria-expanded="expanded"
      :aria-controls="descriptionId"
      @click="expanded = !expanded"
    >
      {{ expanded ? $t('jobs.list.showLess') : $t('jobs.list.showMore') }}
    </button>

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
      <slot name="actions" />
    </div>

    <slot name="footer" />
  </li>
</template>
