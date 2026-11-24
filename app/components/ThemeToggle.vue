<script setup lang="ts">
const colorMode = useColorMode()
const { t } = useI18n()

const options = [
  { value: 'system', label: () => t('theme.system') },
  { value: 'light', label: () => t('theme.light') },
  { value: 'dark', label: () => t('theme.dark') }
] as const
</script>

<template>
  <!-- The stored preference is only known in the browser, so the control renders client-side. -->
  <ClientOnly>
    <div
      role="group"
      :aria-label="$t('theme.label')"
      class="inline-flex rounded-lg bg-surface p-0.5 shadow-sm ring-1 ring-line"
    >
      <button
        v-for="option in options"
        :key="option.value"
        type="button"
        :aria-pressed="colorMode.preference === option.value"
        :title="option.label()"
        class="flex size-8 items-center justify-center rounded-md text-muted transition-colors hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-fg aria-pressed:bg-well aria-pressed:text-fg"
        @click="colorMode.preference = option.value"
      >
        <span class="sr-only">{{ option.label() }}</span>
        <svg class="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <template v-if="option.value === 'system'">
            <rect x="2" y="3" width="20" height="14" rx="2" />
            <path d="M8 21h8M12 17v4" />
          </template>
          <template v-else-if="option.value === 'light'">
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
          </template>
          <path v-else d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
        </svg>
      </button>
    </div>
    <template #fallback>
      <div class="h-9 w-[6.5rem] rounded-lg bg-surface shadow-sm ring-1 ring-line" aria-hidden="true" />
    </template>
  </ClientOnly>
</template>
