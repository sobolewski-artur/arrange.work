<!-- Placeholder cards while a job list's first page loads. -->
<template>
  <ul class="space-y-3" aria-busy="true">
    <li v-for="n in 3" :key="n" class="animate-pulse rounded-2xl bg-surface p-5 ring-1 ring-line">
      <div class="h-4 w-28 rounded bg-well" />
      <div class="mt-4 h-5 w-2/3 rounded bg-well" />
      <div class="mt-3 h-4 w-full rounded bg-well" />
      <div class="mt-2 h-4 w-1/2 rounded bg-well" />
    </li>
  </ul>
</template>
