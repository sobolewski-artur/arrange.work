<script setup lang="ts">
/**
 * Job fields, shared by "Post a job" and "Edit job". The parent saves the emitted job
 * and passes back `submitting` / `error`. Remount it (`:key`) to clear the fields.
 */
const props = defineProps<{
  /** Values to start from when editing; empty form when omitted. */
  initial?: Omit<NewJob, 'location'> & { location: JobLocation | null }
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
// Jobs posted before locations existed have none; treat them as remote.
const locationMode = ref<JobLocationMode>(props.initial?.location?.mode ?? 'remote')
const city = ref(props.initial?.location?.city ?? '')
const budgetAmount = ref<number | ''>(props.initial?.budget?.amount ?? '')
const currency = ref<JobCurrency>(props.initial?.budget?.currency ?? (locale.value === 'pl' ? 'PLN' : 'EUR'))

const needsCity = computed(() => locationMode.value !== 'remote')

// At least one tag is required; text typed but not yet confirmed with Enter counts.
const hasTag = computed(() => tags.value.length > 0 || normalizeTag(tagPending.value) !== '')

const canSubmit = computed(() =>
  !props.submitting && title.value.trim() !== '' && description.value.trim() !== '' && hasTag.value
  && (!needsCity.value || city.value.trim() !== '')
)

function submit() {
  if (!canSubmit.value) return
  tagInput.value?.commit()
  if (tags.value.length === 0) return
  const amount = typeof budgetAmount.value === 'number' && budgetAmount.value > 0 ? Math.round(budgetAmount.value) : null
  emit('submit', {
    title: title.value.trim(),
    tags: tags.value,
    description: description.value.trim(),
    location: { mode: locationMode.value, city: needsCity.value ? city.value.trim() : null },
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

    <fieldset>
      <legend class="text-sm font-medium">{{ $t('jobs.new.fields.location') }}</legend>
      <div class="mt-1 grid grid-cols-3 gap-1 rounded-lg bg-well p-1">
        <label
          v-for="mode in JOB_LOCATION_MODES"
          :key="mode"
          class="relative flex cursor-pointer items-center justify-center gap-1.5 rounded-md px-2 py-2 text-center text-sm font-medium text-muted transition-colors hover:text-fg has-checked:bg-surface has-checked:text-fg has-checked:shadow-sm has-focus-visible:outline-2 has-focus-visible:outline-fg has-disabled:cursor-not-allowed has-disabled:opacity-60"
        >
          <input v-model="locationMode" type="radio" name="location-mode" :value="mode" :disabled="submitting" class="sr-only">
          {{ $t(`jobs.location.${mode}`) }}
        </label>
      </div>
      <div v-if="needsCity" class="mt-3">
        <label for="job-city" class="block text-sm font-medium">{{ $t('jobs.new.fields.city') }}</label>
        <input
          id="job-city"
          v-model="city"
          type="text"
          list="job-city-suggestions"
          autocomplete="address-level2"
          required
          pattern=".*\S.*"
          :maxlength="MAX_JOB_CITY_LENGTH"
          :placeholder="$t('jobs.new.fields.cityPlaceholder')"
          :disabled="submitting"
          :class="inputClass"
        >
        <datalist id="job-city-suggestions">
          <option v-for="c in SUGGESTED_CITIES" :key="c" :value="c" />
        </datalist>
      </div>
    </fieldset>

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
