<script setup lang="ts">
const head = useLocaleHead()

useHead(() => ({
  htmlAttrs: head.value.htmlAttrs,
  link: head.value.link,
  meta: head.value.meta
}))
</script>

<template>
  <NuxtRouteAnnouncer />
  <div class="fixed top-4 right-4 z-10">
    <ThemeToggle />
  </div>
  <NuxtPage />
</template>
