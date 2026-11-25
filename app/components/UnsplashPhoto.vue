<script setup lang="ts">
/**
 * Responsive Unsplash photo with a photographer credit. The image covers the component,
 * so set its shape with a class, e.g. `class="aspect-[4/3] rounded-3xl"`.
 */
const props = withDefaults(defineProps<{
  photo: PhotoKey
  /** `sizes` attribute: how wide the image is shown, so the browser picks a fitting file. */
  sizes?: string
  /** Above-the-fold image: load immediately with high priority. */
  priority?: boolean
}>(), { sizes: '100vw', priority: false })

const WIDTHS = [480, 800, 1200, 1600, 2000]

const photo = computed(() => PHOTOS[props.photo])
const srcset = computed(() => WIDTHS.map(w => `${unsplashSrc(photo.value.id, w)} ${w}w`).join(', '))
</script>

<template>
  <figure class="relative overflow-hidden bg-well">
    <img
      :src="unsplashSrc(photo.id, 1200)"
      :srcset="srcset"
      :sizes="sizes"
      :alt="$t(`photos.alt.${props.photo}`)"
      :loading="priority ? 'eager' : 'lazy'"
      :fetchpriority="priority ? 'high' : 'auto'"
      decoding="async"
      class="absolute inset-0 size-full object-cover"
    >
    <figcaption class="absolute right-2 bottom-2 rounded-md bg-black/55 px-2 py-0.5 text-[11px] text-white/90 backdrop-blur-sm">
      {{ $t('photos.credit') }}
      <a :href="`${photo.page}?${UNSPLASH_REFERRAL}`" target="_blank" rel="noopener" class="underline-offset-2 hover:underline">{{ photo.author }}</a>
      /
      <a :href="`https://unsplash.com/?${UNSPLASH_REFERRAL}`" target="_blank" rel="noopener" class="underline-offset-2 hover:underline">Unsplash</a>
    </figcaption>
  </figure>
</template>
