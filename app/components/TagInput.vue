<script setup lang="ts">
/**
 * Free-text tag field: typed text becomes a chip on Enter or ",", pasted comma lists are
 * split, × or Backspace removes chips. Tags are normalized (see utils/tags.ts).
 *
 * v-model is the tag list; v-model:pending is text typed but not yet confirmed.
 * Call `commit()` (via a template ref) to turn pending text into a tag, e.g. before submit.
 */
const props = withDefaults(defineProps<{
  id: string
  max?: number
  placeholder: string
  limitPlaceholder: string
  disabled?: boolean
  required?: boolean
  describedby?: string
}>(), { max: MAX_JOB_TAGS, disabled: false, required: false, describedby: undefined })

const tags = defineModel<string[]>({ required: true })
const pending = defineModel<string>('pending', { default: '' })

const inputEl = ref<HTMLInputElement | null>(null)
const limitReached = computed(() => tags.value.length >= props.max)

/** Adds comma-separated text as tags (normalized, de-duplicated, capped). */
function addTags(text: string) {
  const next = normalizeTags([...tags.value, ...text.split(',')], props.max)
  if (next.join(',') !== tags.value.join(',')) tags.value = next
}

function commit() {
  if (pending.value.trim()) addTags(pending.value)
  pending.value = ''
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === 'Enter' || event.key === ',') {
    // Enter adds the tag instead of submitting a surrounding form.
    event.preventDefault()
    commit()
  } else if (event.key === 'Backspace' && pending.value === '' && tags.value.length > 0) {
    tags.value = tags.value.slice(0, -1)
  }
}

// Pasted text, and phone keyboards that don't report "," as a key, arrive here.
function onInput() {
  if (!pending.value.includes(',')) return
  const parts = pending.value.split(',')
  const rest = parts.pop() ?? ''
  addTags(parts.join(','))
  pending.value = limitReached.value ? '' : rest
}

function remove(tag: string) {
  tags.value = tags.value.filter(t => t !== tag)
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
      v-for="tag in tags"
      :key="tag"
      class="inline-flex max-w-full items-center gap-0.5 rounded-full bg-well py-0.5 pr-0.5 pl-2.5 text-sm"
    >
      <span class="truncate">{{ tag }}</span>
      <button
        type="button"
        class="flex size-6 shrink-0 items-center justify-center rounded-full text-muted transition hover:bg-hover hover:text-fg focus-visible:outline-2 focus-visible:outline-fg"
        :aria-label="$t('jobs.new.fields.removeTag', { tag })"
        :disabled="disabled"
        @click.stop="remove(tag)"
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
      :aria-required="required ? 'true' : undefined"
      :aria-describedby="describedby"
      :placeholder="limitReached ? limitPlaceholder : placeholder"
      :disabled="disabled || limitReached"
      class="min-w-32 flex-1 bg-transparent px-1 py-1 text-sm outline-none placeholder:text-subtle disabled:cursor-not-allowed"
      @keydown="onKeydown"
      @input="onInput"
      @blur="commit"
    >
  </div>
</template>
