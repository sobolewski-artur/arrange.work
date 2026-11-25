<!-- Single-card pages (login, account, …): just the floating theme toggle. -->
<template>
  <div>
    <div class="fixed top-4 right-4 z-10">
      <ThemeToggle />
    </div>
    <slot />
  </div>
</template>
