<!-- Site header and footer, for public and signed-in pages (home, about, account). Use with definePageMeta({ layout: 'site' }). -->
<template>
  <div class="flex min-h-screen flex-col bg-page text-fg">
    <SiteHeader />
    <main class="flex-1">
      <slot />
    </main>
    <SiteFooter />
  </div>
</template>
