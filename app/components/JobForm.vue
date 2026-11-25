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

// --- Tags: typed by the client; Enter or "," turns the text into a chip ---

const tags = ref<string[]>(normalizeTags(props.initial?.tags ?? []))
const tagInput = ref('')
const tagInputEl = ref<HTMLInputElement | null>(null)
const tagLimitReached = computed(() => tags.value.length >= MAX_JOB_TAGS)

/** Adds comma-separated text as tags (normalized, de-duplicated, capped). */
function addTags(text: string) {
  tags.value = normalizeTags([...tags.value, ...text.split(',')])
}

function commitTagInput() {
  if (tagInput.value.trim()) addTags(tagInput.value)
  tagInput.value = ''
}

function onTagKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ',') {
    // Enter adds the tag instead of submitting the form.
    event.preventDefault()
    commitTagInput()
  } else if (event.key === 'Backspace' && tagInput.value === '' && tags.value.length > 0) {
    tags.value = tags.value.slice(0, -1)
  }
}

// Pasted text, and phone keyboards that don't report "," as a key, arrive here.
function onTagInput() {
  if (!tagInput.value.includes(',')) return
  const parts = tagInput.value.split(',')
  const rest = parts.pop() ?? ''
  addTags(parts.join(','))
  tagInput.value = tagLimitReached.value ? '' : rest
}

function removeTag(tag: string) {
  tags.value = tags.value.filter(t => t !== tag)
  nextTick(() => tagInputEl.value?.focus())
}
const description = ref(props.initial?.description ?? '')
// Jobs posted before locations existed have none; treat them as remote.
const locationMode = ref<JobLocationMode>(props.initial?.location?.mode ?? 'remote')
const city = ref(props.initial?.location?.city ?? '')
const budgetAmount = ref<number | ''>(props.initial?.budget?.amount ?? '')
const currency = ref<JobCurrency>(props.initial?.budget?.currency ?? (locale.value === 'pl' ? 'PLN' : 'EUR'))

const needsCity = computed(() => locationMode.value !== 'remote')

// At least one tag is required; text typed but not yet confirmed with Enter counts.
const hasTag = computed(() => tags.value.length > 0 || normalizeTag(tagInput.value) !== '')

const canSubmit = computed(() =>
  !props.submitting && title.value.trim() !== '' && description.value.trim() !== '' && hasTag.value
  && (!needsCity.value || city.value.trim() !== '')
)

function submit() {
  if (!canSubmit.value) return
  commitTagInput()
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
      <!-- Chips and the text field share one box; clicking the box focuses the field. -->
      <div
        class="mt-1 flex min-h-10 cursor-text flex-wrap items-center gap-1.5 rounded-lg bg-surface px-2 py-1.5 ring-1 ring-line-strong focus-within:outline-2 focus-within:outline-fg"
        :class="submitting && 'opacity-60'"
        @click="tagInputEl?.focus()"
      >
        <span
          v-for="tag in tags"
          :key="tag"
          class="inline-flex max-w-full items-center gap-0.5 rounded-full bg-well py-0.5 pr-0.5 pl-2.5 text-sm"
        >
          <span class="truncate">{{ tag }}</span>
          <button
            type="button"
            class="flex size-6 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-fg"
            :aria-label="$t('jobs.new.fields.removeTag', { tag })"
            :disabled="submitting"
            @click.stop="removeTag(tag)"
          >
            <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </span>
        <input
          id="job-tags"
          ref="tagInputEl"
          v-model="tagInput"
          type="text"
          autocomplete="off"
          enterkeyhint="enter"
          aria-required="true"
          aria-describedby="job-tags-hint"
          :placeholder="tagLimitReached ? $t('jobs.new.fields.tagsLimit') : $t('jobs.new.fields.tagsPlaceholder')"
          :disabled="submitting || tagLimitReached"
          class="min-w-32 flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-subtle disabled:cursor-not-allowed"
          @keydown="onTagKeydown"
          @input="onTagInput"
          @blur="commitTagInput"
        >
      </div>
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
