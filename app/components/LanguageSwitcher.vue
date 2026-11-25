<script setup lang="ts">
const { locale, locales } = useI18n()
const switchLocalePath = useSwitchLocalePath()
</script>

<template>
  <nav :aria-label="$t('language')" class="inline-flex rounded-lg bg-surface p-0.5 shadow-sm ring-1 ring-line">
    <NuxtLink
      v-for="l in locales"
      :key="l.code"
      :to="switchLocalePath(l.code)"
      :hreflang="l.language"
      :lang="l.language"
      :title="l.name"
      class="flex h-8 items-center rounded-md px-2.5 text-xs font-semibold uppercase transition-colors focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-fg"
      :class="l.code === locale ? 'bg-well text-fg' : 'text-muted hover:text-fg'"
    >
      {{ l.code }}
    </NuxtLink>
  </nav>
</template>
