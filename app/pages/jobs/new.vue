<script setup lang="ts">
import type { FirebaseError } from 'firebase/app'

definePageMeta({ middleware: 'auth', layout: 'site' })

const { t, locale } = useI18n()
const localePath = useLocalePath()
const user = useCurrentUser()

useHead({ title: () => t('jobs.new.title') })

const title = ref('')
const category = ref<CategoryKey | ''>('')
const description = ref('')
const locationMode = ref<JobLocationMode>('remote')
const city = ref('')
const budgetAmount = ref<number | ''>('')
const currency = ref<JobCurrency>(locale.value === 'pl' ? 'PLN' : 'EUR')

const submitting = ref(false)
const error = ref<string | null>(null)
/** Title of the job just posted; switches the page to the confirmation. */
const postedTitle = ref<string | null>(null)

const needsCity = computed(() => locationMode.value !== 'remote')

const canSubmit = computed(() =>
  !submitting.value && title.value.trim() !== '' && category.value !== '' && description.value.trim() !== ''
  && (!needsCity.value || city.value.trim() !== '')
)

async function submit() {
  const u = user.value
  if (!u || !canSubmit.value || category.value === '') return
  submitting.value = true
  error.value = null
  try {
    const amount = typeof budgetAmount.value === 'number' && budgetAmount.value > 0 ? Math.round(budgetAmount.value) : null
    await postJob(u, {
      title: title.value.trim(),
      category: category.value,
      description: description.value.trim(),
      location: { mode: locationMode.value, city: needsCity.value ? city.value.trim() : null },
      budget: amount ? { amount, currency: currency.value } : null
    })
    postedTitle.value = title.value.trim()
  } catch (e) {
    console.error(e)
    const code = (e as FirebaseError).code
    error.value = code === 'unavailable' ? t('auth.errors.network') : t('jobs.new.errors.failed')
  } finally {
    submitting.value = false
  }
}

function postAnother() {
  title.value = ''
  category.value = ''
  description.value = ''
  locationMode.value = 'remote'
  city.value = ''
  budgetAmount.value = ''
  postedTitle.value = null
}

const inputClass = 'mt-1 block w-full rounded-lg bg-surface px-3 py-2 text-sm ring-1 ring-line-strong placeholder:text-subtle focus:outline-2 focus:outline-offset-0 focus:outline-fg disabled:opacity-60'
const primaryButton = 'inline-flex items-center justify-center rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-on-primary transition hover:bg-primary-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg disabled:cursor-not-allowed disabled:opacity-60'
const secondaryButton = 'inline-flex items-center justify-center rounded-lg bg-surface px-5 py-2.5 text-sm font-medium ring-1 ring-line-strong transition hover:bg-hover focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-fg'
</script>

<template>
  <div class="flex justify-center px-4 py-12 sm:py-16">
    <!-- `user` is only set in the browser, so nothing user-specific is server-rendered. -->
    <div v-if="user" class="w-full max-w-2xl rounded-2xl bg-surface p-6 shadow-sm ring-1 ring-line sm:p-8">
      <!-- Confirmation -->
      <div v-if="postedTitle" class="py-6 text-center" role="status">
        <span class="mx-auto flex size-12 items-center justify-center rounded-full bg-success-soft text-success ring-1 ring-success-line">
          <svg class="size-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <h1 class="mt-5 text-2xl font-bold tracking-tight">{{ $t('jobs.new.posted.title') }}</h1>
        <p class="mt-2 text-pretty text-muted">{{ $t('jobs.new.posted.text', { title: postedTitle }) }}</p>
        <div class="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <NuxtLink :to="localePath('/jobs')" :class="primaryButton">{{ $t('jobs.new.posted.viewJobs') }}</NuxtLink>
          <button type="button" :class="secondaryButton" @click="postAnother">{{ $t('jobs.new.posted.another') }}</button>
        </div>
      </div>

      <!-- Form -->
      <template v-else>
        <h1 class="text-2xl font-bold tracking-tight">{{ $t('jobs.new.title') }}</h1>
        <p class="mt-1 text-sm text-pretty text-muted">{{ $t('jobs.new.subtitle') }}</p>

        <form class="mt-8 space-y-5" @submit.prevent="submit">
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
            <label for="job-category" class="block text-sm font-medium">{{ $t('jobs.new.fields.category') }}</label>
            <select
              id="job-category"
              v-model="category"
              required
              :disabled="submitting"
              :class="[inputClass, category === '' && 'text-subtle']"
            >
              <option value="" disabled>{{ $t('jobs.new.fields.categoryPlaceholder') }}</option>
              <option v-for="c in CATEGORIES" :key="c.key" :value="c.key" class="text-fg">
                {{ $t(`home.categories.items.${c.key}.title`) }}
              </option>
            </select>
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
            <NuxtLink :to="localePath('/')" :class="secondaryButton">{{ $t('account.cancel') }}</NuxtLink>
            <button type="submit" :class="primaryButton" :disabled="!canSubmit">
              {{ submitting ? $t('auth.pending') : $t('jobs.new.submit') }}
            </button>
          </div>
        </form>
      </template>
    </div>
  </div>
</template>
