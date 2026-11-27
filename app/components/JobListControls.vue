<script setup lang="ts">
/**
 * Tag filter, optional location filter (a country, then optionally a city in it) and sort menu
 * above a job list (see composables/useJobList.ts). Pass `v-model:place` and `show-locations`
 * to show the location filter.
 */
const props = defineProps<{ sort: JobSort, showLocations?: boolean }>()
defineEmits<{ 'update:sort': [value: string] }>()

const filter = defineModel<string[]>('filter', { required: true })
const place = defineModel<JobPlaceFilter>('place', { default: () => ({ ...NO_PLACE_FILTER }) })

const { options: countryOptions } = useCountries()
const citySuggestions = computed(() => place.value.country ? CITY_SUGGESTIONS[place.value.country] : undefined)

// A new country clears the city, which belonged to the old one. The city is applied when the
// field changes (Enter, leaving it, or picking a suggestion), not on every keystroke.
function setCountry(event: Event) {
  const value = (event.target as HTMLSelectElement).value
  place.value = { country: value || null, city: null }
}
function setCity(event: Event) {
  const input = event.target as HTMLInputElement
  const city = normalizeCity(input.value)
  input.value = city ?? ''
  if (city !== place.value.city) place.value = { ...place.value, city }
}
// Picking a suggestion applies it straight away (Chrome reports it as a replacement; Firefox
// fires a plain Event), as in TagInput.
function onCityInput(event: Event) {
  const text = (event.target as HTMLInputElement).value
  const picked = (event as InputEvent).inputType === 'insertReplacementText'
    || (!(event instanceof InputEvent) && !!citySuggestions.value?.includes(text))
  if (picked) setCity(event)
}

const gridClass = computed(() => props.showLocations
  ? 'grid gap-4 md:grid-cols-2 lg:grid-cols-[1fr_1fr_auto]'
  : 'grid gap-4 sm:grid-cols-[1fr_auto]')

const fieldClass = 'block h-10 w-full min-w-0 rounded-lg bg-surface text-sm ring-1 ring-line-strong focus:outline-2 focus:outline-offset-0 focus:outline-fg'
const clearButton = 'inline-flex min-h-10 shrink-0 items-center rounded-lg bg-surface px-3 py-2 text-sm font-medium ring-1 ring-line-strong transition hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg'
</script>

<template>
  <div :class="gridClass">
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
    <fieldset v-if="showLocations" class="min-w-0" aria-describedby="job-location-filter-hint">
      <legend class="block text-sm font-medium">{{ $t('jobs.list.locationFilter.label') }}</legend>
      <div class="mt-1 flex items-start gap-2">
        <div class="grid min-w-0 flex-1 grid-cols-2 gap-2">
          <label for="job-country-filter" class="sr-only">{{ $t('jobs.list.locationFilter.country') }}</label>
          <select
            id="job-country-filter"
            :value="place.country ?? ''"
            :class="[fieldClass, 'px-2']"
            @change="setCountry"
          >
            <option value="">{{ $t('jobs.list.locationFilter.anyCountry') }}</option>
            <option v-for="option in countryOptions" :key="option.code" :value="option.code">{{ option.name }}</option>
          </select>
          <label for="job-city-filter" class="sr-only">{{ $t('jobs.list.locationFilter.city') }}</label>
          <input
            id="job-city-filter"
            :value="place.city ?? ''"
            type="text"
            autocomplete="off"
            enterkeyhint="search"
            :list="citySuggestions ? 'job-city-filter-suggestions' : undefined"
            :disabled="!place.country"
            :placeholder="$t(place.country ? 'jobs.list.locationFilter.cityPlaceholder' : 'jobs.list.locationFilter.cityNeedsCountry')"
            :maxlength="MAX_JOB_CITY_LENGTH"
            :class="[fieldClass, 'px-3 placeholder:text-subtle disabled:cursor-not-allowed disabled:opacity-60']"
            @change="setCity"
            @input="onCityInput"
            @keydown.enter.prevent="setCity"
          >
          <datalist v-if="citySuggestions" id="job-city-filter-suggestions">
            <option v-for="city in citySuggestions" :key="city" :value="city" />
          </datalist>
        </div>
        <button v-if="place.country" type="button" :class="clearButton" @click="place = { ...NO_PLACE_FILTER }">
          {{ $t('jobs.list.filter.clear') }}
        </button>
      </div>
      <p id="job-location-filter-hint" class="mt-1 text-xs text-muted">{{ $t('jobs.list.locationFilter.hint') }}</p>
    </fieldset>
    <div :class="showLocations && 'md:col-span-2 lg:col-span-1'">
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
