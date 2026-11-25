/**
 * Unsplash photos used on the public pages (free under the Unsplash License, https://unsplash.com/license).
 * `id` is the images.unsplash.com file id; `page` is the photo's Unsplash page, linked in the credit.
 * Alt texts are translated under `photos.alt.<key>`.
 */
export const PHOTOS = {
  hero: { id: '1543269866-487350d6fa5e', page: 'https://unsplash.com/photos/xcgh5_-QIXc', author: 'Brooke Cagle' },
  clients: { id: '1517048676732-d65bc937f952', page: 'https://unsplash.com/photos/KdeqA3aTnBY', author: 'Dylan Gillis' },
  specialists: { id: '1546514714-df0ccc50d7bf', page: 'https://unsplash.com/photos/4wOkqiXNP7M', author: 'Per Lööv' },
  team: { id: '1522071820081-009f0129c71c', page: 'https://unsplash.com/photos/QckxruozjRg', author: 'Annie Spratt' },
  collaboration: { id: '1758873268695-1b55590e507a', page: 'https://unsplash.com/photos/Y32qbykD69g', author: 'Vitaly Gariev' },
  hands: { id: '1582213782179-e0d53f98f2ca', page: 'https://unsplash.com/photos/Zyx1bK9mqmA', author: 'Hannah Busing' }
} as const

export type PhotoKey = keyof typeof PHOTOS

/** Unsplash asks for these on links back to the site. */
export const UNSPLASH_REFERRAL = 'utm_source=arrange_work&utm_medium=referral'

/** Resized image from Unsplash's CDN (served as WebP/AVIF where the browser supports it). */
export function unsplashSrc(id: string, width: number) {
  return `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${width}&q=75`
}
