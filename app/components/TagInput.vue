<script setup lang="ts">
/**
 * Free-text chip field (tags, cities…): typed text becomes a chip on Enter or ",", pasted
 * comma lists are split, × or Backspace removes chips. Values go through `normalize`
 * (default: tag rules from utils/tags.ts). With `suggestions`, the field offers them as you
 * type, and picking one adds it straight away.
 *
 * v-model is the list; v-model:pending is text typed but not yet confirmed.
 * Call `commit()` (via a template ref) to turn pending text into a chip, e.g. before submit.
 */
const props = withDefaults(defineProps<{
  id: string
  max?: number
  placeholder: string
  limitPlaceholder: string
  disabled?: boolean
  required?: boolean
  describedby?: string
  /** Cleans the whole list (new values appended); returns at most `max` items. */
  normalize?: (values: unknown, max: number) => string[]
  suggestions?: readonly string[]
  /** Accessible label for a chip's × button; gets the chip text as {value}. */
  removeLabelKey?: string
}>(), {
  max: MAX_JOB_TAGS,
  disabled: false,
  required: false,
  describedby: undefined,
  normalize: normalizeTags,
  suggestions: undefined,
  removeLabelKey: 'jobs.new.fields.removeTag'
})

const values = defineModel<string[]>({ required: true })
const pending = defineModel<string>('pending', { default: '' })

const inputEl = ref<HTMLInputElement | null>(null)
const limitReached = computed(() => values.value.length >= props.max)
const listId = computed(() => props.suggestions ? `${props.id}-suggestions` : undefined)
// Don't suggest what's already picked.
const openSuggestions = computed(() => props.suggestions?.filter(s => !values.value.some(v => v.toLocaleLowerCase() === s.toLocaleLowerCase())) ?? [])

/** Adds comma-separated text (normalized, de-duplicated, capped). */
function add(text: string) {
  const next = props.normalize([...values.value, ...text.split(',')], props.max)
  if (next.join(',') !== values.value.join(',')) values.value = next
}

function commit(text = pending.value) {
  if (text.trim()) add(text)
  pending.value = ''
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ',') {
    // Enter adds the chip instead of submitting a surrounding form.
    event.preventDefault()
    commit()
  } else if (event.key === 'Backspace' && pending.value === '' && values.value.length > 0) {
    values.value = values.value.slice(0, -1)
  }
}

function onInput(event: Event) {
  // Read the field itself: `pending` is the parent's v-model and only updates after this
  // handler, so it would still hold the text from before this input.
  const text = (event.target as HTMLInputElement).value
  // Picking a suggestion from the list adds it right away (Chrome reports it as a replacement;
  // Firefox fires a plain Event).
  const picked = (event as InputEvent).inputType === 'insertReplacementText'
    || (!(event instanceof InputEvent) && !!props.suggestions?.includes(text))
  if (picked) {
    commit(text)
    return
  }
  // Pasted text, and phone keyboards that don't report "," as a key, arrive here.
  if (!text.includes(',')) return
  const parts = text.split(',')
  const rest = parts.pop() ?? ''
  add(parts.join(','))
  pending.value = limitReached.value ? '' : rest
}

function remove(value: string) {
  values.value = values.value.filter(v => v !== value)
  nextTick(() => inputEl.value?.focus())
}

defineExpose({ commit, focus: () => inputEl.value?.focus() })
</script>

<template>
  <!-- Chips and the text field share one box; clicking the box focuses the field. -->
  <div
    class="flex min-h-10 cursor-text flex-wrap items-center gap-1.5 rounded-lg bg-surface px-2 py-1.5 ring-1 ring-line-strong focus-within:outline-2 focus-within:outline-fg"
    :class="disabled && 'opacity-60'"
    @click="inputEl?.focus()"
  >
    <span
      v-for="value in values"
      :key="value"
      class="inline-flex max-w-full items-center gap-0.5 rounded-full bg-well py-0.5 pr-0.5 pl-2.5 text-sm"
    >
      <span class="truncate">{{ value }}</span>
      <button
        type="button"
        class="flex size-6 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-fg"
        :aria-label="$t(removeLabelKey, { value, tag: value })"
        :disabled="disabled"
        @click.stop="remove(value)"
      >
        <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" aria-hidden="true">
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </span>
    <input
      :id="id"
      ref="inputEl"
      v-model="pending"
      type="text"
      autocomplete="off"
      enterkeyhint="enter"
      :list="listId"
      :aria-required="required ? 'true' : undefined"
      :aria-describedby="describedby"
      :placeholder="limitReached ? limitPlaceholder : placeholder"
      :disabled="disabled || limitReached"
      class="min-w-32 flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-subtle disabled:cursor-not-allowed"
      @keydown="onKeydown"
      @input="onInput"
      @blur="commit()"
    >
    <datalist v-if="listId" :id="listId">
      <option v-for="s in openSuggestions" :key="s" :value="s" />
    </datalist>
  </div>
</template>
