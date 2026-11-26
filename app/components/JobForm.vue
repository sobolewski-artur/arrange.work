<script setup lang="ts">
/**
 * Job fields, shared by "Post a job" and "Edit job". The parent saves the emitted job
 * and passes back `submitting` / `error`. Remount it (`:key`) to clear the fields.
 */
const props = defineProps<{
  /** Values to start from when editing; empty form when omitted. */
  initial?: Omit<NewJob, 'country'> & { country: string | null }
  submitLabel: string
  cancelTo: string
  submitting: boolean
  error: string | null
}>()

const emit = defineEmits<{ submit: [job: NewJob] }>()

const { locale } = useI18n()

const title = ref(props.initial?.title ?? '')

// Tags are typed by the client (see components/TagInput.vue). `tagPending` is text typed but not
// yet confirmed with Enter; it counts towards the required tag and is added on submit.
const tags = ref<string[]>(normalizeTags(props.initial?.tags ?? []))
const tagPending = ref('')
const tagInput = ref<{ commit: () => void } | null>(null)

const description = ref(props.initial?.description ?? '')

// Location: a country (required; jobs from before countries existed default to Poland) and
// optional cities in it, with suggestions for the chosen country. Like tags, a city typed but
// not yet confirmed with Enter is added on submit.
const { options: countryOptions } = useCountries()
const country = ref(props.initial?.country ?? DEFAULT_COUNTRY)
const citySuggestions = computed(() => CITY_SUGGESTIONS[country.value])
const locations = ref<string[]>(normalizeLocations(props.initial?.locations ?? []))
const locationPending = ref('')
const locationInput = ref<{ commit: () => void } | null>(null)

const budgetAmount = ref<number | ''>(props.initial?.budget?.amount ?? '')
const currency = ref<JobCurrency>(props.initial?.budget?.currency ?? (locale.value === 'pl' ? 'PLN' : 'EUR'))

// At least one tag is required; text typed but not yet confirmed with Enter counts.
const hasTag = computed(() => tags.value.length > 0 || normalizeTag(tagPending.value) !== '')

const canSubmit = computed(() =>
  !props.submitting && title.value.trim() !== '' && description.value.trim() !== '' && hasTag.value
  && isCountryCode(country.value)
)

function submit() {
  if (!canSubmit.value) return
  tagInput.value?.commit()
  locationInput.value?.commit()
  if (tags.value.length === 0) return
  const amount = typeof budgetAmount.value === 'number' && budgetAmount.value > 0 ? Math.round(budgetAmount.value) : null
  emit('submit', {
    title: title.value.trim(),
    tags: tags.value,
    description: description.value.trim(),
    country: country.value,
    locations: locations.value,
    budget: amount ? { amount, currency: currency.value } : null
  })
}

const inputClass = 'mt-1 block w-full rounded-lg bg-surface px-3 py-2 text-sm ring-1 ring-line-strong placeholder:text-subtle focus:outline-2 focus:outline-offset-0 focus:outline-fg disabled:opacity-60'
const primaryButton = 'inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-on-primary transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:cursor-not-allowed disabled:opacity-60'
const secondaryButton = 'inline-flex items-center justify-center rounded-lg bg-surface px-5 py-2.5 text-sm font-medium ring-1 ring-line-strong transition hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg'
</script>

<template>
  <form class="space-y-5" @submit.prevent="submit">
    <div>
      <label for="job-title" class="block text-sm font-medium">{{ $t('jobs.new.fields.title') }}</label>
      <input
        id="job-title"
        v-model="title"
        type="text"
        required
        pattern=".*\S.*"
        :maxlength="MAX_JOB_TITLE_LENGTH"
        :placeholder="$t('jobs.new.fields.titlePlaceholder')"
        :disabled="submitting"
        :class="inputClass"
      >
    </div>

    <div>
      <div class="flex items-baseline justify-between gap-4">
        <label for="job-tags" class="block text-sm font-medium">{{ $t('jobs.new.fields.tags') }}</label>
        <span class="text-xs text-subtle tabular-nums" aria-hidden="true">{{ tags.length }} / {{ MAX_JOB_TAGS }}</span>
      </div>
      <TagInput
        id="job-tags"
        ref="tagInput"
        v-model="tags"
        v-model:pending="tagPending"
        class="mt-1"
        required
        describedby="job-tags-hint"
        :max="MAX_JOB_TAGS"
        :placeholder="$t('jobs.new.fields.tagsPlaceholder')"
        :limit-placeholder="$t('jobs.new.fields.tagsLimit')"
        :disabled="submitting"
      />
      <p id="job-tags-hint" class="mt-1 text-xs text-muted">
        {{ $t('jobs.new.fields.tagsHint', { max: MAX_JOB_TAGS, length: MAX_TAG_LENGTH }) }}
      </p>
    </div>

    <div>
      <label for="job-country" class="block text-sm font-medium">{{ $t('jobs.new.fields.country') }}</label>
      <select
        id="job-country"
        v-model="country"
        required
        autocomplete="country"
        :disabled="submitting"
        :class="inputClass"
      >
        <option v-for="option in countryOptions" :key="option.code" :value="option.code">{{ option.name }}</option>
      </select>
    </div>

    <div>
      <div class="flex items-baseline justify-between gap-4">
        <label for="job-locations" class="block text-sm font-medium">
          {{ $t('jobs.new.fields.locations') }}
          <span class="font-normal text-muted">({{ $t('jobs.new.fields.optional') }})</span>
        </label>
        <span class="text-xs text-subtle tabular-nums" aria-hidden="true">{{ locations.length }} / {{ MAX_JOB_LOCATIONS }}</span>
      </div>
      <TagInput
        id="job-locations"
        ref="locationInput"
        v-model="locations"
        v-model:pending="locationPending"
        class="mt-1"
        describedby="job-locations-hint"
        :max="MAX_JOB_LOCATIONS"
        :normalize="normalizeLocations"
        :suggestions="citySuggestions"
        remove-label-key="jobs.new.fields.removeLocation"
        :placeholder="$t('jobs.new.fields.locationsPlaceholder')"
        :limit-placeholder="$t('jobs.new.fields.locationsLimit')"
        :disabled="submitting"
      />
      <p id="job-locations-hint" class="mt-1 text-xs text-muted">
        {{ $t('jobs.new.fields.locationsHint', { max: MAX_JOB_LOCATIONS }) }}
      </p>
    </div>

    <div>
      <div class="flex items-baseline justify-between gap-4">
        <label for="job-description" class="block text-sm font-medium">{{ $t('jobs.new.fields.description') }}</label>
        <span class="text-xs text-subtle tabular-nums" aria-hidden="true">
          {{ description.length }} / {{ MAX_JOB_DESCRIPTION_LENGTH }}
        </span>
      </div>
      <textarea
        id="job-description"
        v-model="description"
        required
        rows="6"
        :maxlength="MAX_JOB_DESCRIPTION_LENGTH"
        :placeholder="$t('jobs.new.fields.descriptionPlaceholder')"
        :disabled="submitting"
        :class="[inputClass, 'resize-y']"
      />
    </div>

    <fieldset>
      <legend class="text-sm font-medium">
        {{ $t('jobs.new.fields.budget') }}
        <span class="font-normal text-muted">({{ $t('jobs.new.fields.optional') }})</span>
      </legend>
      <div class="mt-1 flex gap-2">
        <label for="job-budget" class="sr-only">{{ $t('jobs.new.fields.budgetAmount') }}</label>
        <input
          id="job-budget"
          v-model.number="budgetAmount"
          type="number"
          inputmode="numeric"
          min="1"
          step="1"
          :disabled="submitting"
          class="mt-0! min-w-0 flex-1"
          :class="inputClass"
        >
        <label for="job-currency" class="sr-only">{{ $t('jobs.new.fields.currency') }}</label>
        <select
          id="job-currency"
          v-model="currency"
          :disabled="submitting"
          class="mt-0! w-24! shrink-0"
          :class="inputClass"
        >
          <option v-for="c in JOB_CURRENCIES" :key="c" :value="c">{{ c }}</option>
        </select>
      </div>
    </fieldset>

    <p v-if="error" role="alert" class="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger ring-1 ring-danger-line">
      {{ error }}
    </p>

    <div class="flex flex-col-reverse gap-3 border-t border-line pt-6 sm:flex-row sm:justify-end">
      <NuxtLink :to="cancelTo" :class="secondaryButton">{{ $t('account.cancel') }}</NuxtLink>
      <button type="submit" :class="primaryButton" :disabled="!canSubmit">
        {{ submitting ? $t('auth.pending') : submitLabel }}
      </button>
    </div>
  </form>
</template>
