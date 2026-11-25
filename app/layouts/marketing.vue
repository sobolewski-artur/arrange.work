<!-- Public pages (home, about): site header and footer. Use with definePageMeta({ layout: 'marketing' }). -->
<template>
  <div class="flex min-h-screen flex-col bg-page text-fg">
    <SiteHeader />
    <main class="flex-1">
      <slot />
    </main>
    <SiteFooter />
  </div>
</template>
