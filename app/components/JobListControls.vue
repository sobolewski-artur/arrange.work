<script setup lang="ts">
/** Tag filter and sort menu above a job list (see composables/useJobList.ts). */
defineProps<{ sort: JobSort }>()
defineEmits<{ 'update:sort': [value: string] }>()

const filter = defineModel<string[]>('filter', { required: true })

const clearButton = 'inline-flex min-h-10 shrink-0 items-center rounded-lg bg-surface px-3 py-2 text-sm font-medium ring-1 ring-line-strong transition hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg'
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-[1fr_auto]">
    <div class="min-w-0">
      <label for="job-filter" class="block text-sm font-medium">{{ $t('jobs.list.filter.label') }}</label>
      <div class="mt-1 flex items-start gap-2">
        <TagInput
          id="job-filter"
          v-model="filter"
          class="min-w-0 flex-1"
          describedby="job-filter-hint"
          :max="MAX_FILTER_TAGS"
          :placeholder="$t('jobs.list.filter.placeholder')"
          :limit-placeholder="$t('jobs.list.filter.limit')"
        />
        <button v-if="filter.length" type="button" :class="clearButton" @click="filter = []">
          {{ $t('jobs.list.filter.clear') }}
        </button>
      </div>
      <p id="job-filter-hint" class="mt-1 text-xs text-muted">{{ $t('jobs.list.filter.hint') }}</p>
    </div>
    <div>
      <label for="job-sort" class="block text-sm font-medium">{{ $t('jobs.list.sort.label') }}</label>
      <select
        id="job-sort"
        :value="sort"
        class="mt-1 block h-10 w-full rounded-lg bg-surface px-3 text-sm ring-1 ring-line-strong focus:outline-2 focus:outline-offset-0 focus:outline-fg sm:w-auto"
        @change="$emit('update:sort', ($event.target as HTMLSelectElement).value)"
      >
        <option v-for="option in JOB_SORTS" :key="option" :value="option">{{ $t(`jobs.list.sort.${option}`) }}</option>
      </select>
      <p v-if="sort === 'budgetHigh' || sort === 'budgetLow'" class="mt-1 text-xs text-muted sm:max-w-56">
        {{ $t('jobs.list.sort.budgetNote') }}
      </p>
    </div>
  </div>
</template>
