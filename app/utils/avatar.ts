
/** Largest image file accepted before resizing (the uploaded avatar itself is much smaller). */
export const MAX_AVATAR_SOURCE_MB = 2

/** Avatars are stored as squares of at most this many pixels per side. */
const AVATAR_SIZE = 256

/** The picked file isn't an image the browser can decode (e.g. HEIC outside Safari) or is too large. */
export class AvatarFileError extends Error {
  constructor(readonly reason: 'unreadable' | 'tooLarge') {
    super(`Avatar file rejected: ${reason}`)
  }
}

/** Center-crops the image to a square and scales it down to AVATAR_SIZE. */
async function toSquareAvatar(file: File): Promise<Blob> {
  if (!file.type.startsWith('image/')) throw new AvatarFileError('unreadable')
  if (file.size > MAX_AVATAR_SOURCE_MB * 1024 * 1024) throw new AvatarFileError('tooLarge')

  let bitmap: ImageBitmap
  try {
    // Applies EXIF orientation, so phone photos aren't sideways.
    bitmap = await createImageBitmap(file)
  } catch {
    throw new AvatarFileError('unreadable')
  }

  const canvas = document.createElement('canvas')
  try {
    const side = Math.min(bitmap.width, bitmap.height)
    const out = Math.min(AVATAR_SIZE, side)
    canvas.width = canvas.height = out
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new AvatarFileError('unreadable')
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, out, out)
  } finally {
    bitmap.close()
  }

  // WebP where the browser can encode it; otherwise toBlob falls back to PNG (e.g. Safari).
  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => blob ? resolve(blob) : reject(new AvatarFileError('unreadable')), 'image/webp', 0.9)
  })
}

/**
 * Resizes `file`, uploads it to the Neon `avatars` bucket (server/api/me/avatar.put.ts, which
 * also deletes the user's older ones) and sets its URL as the user's profile image. Each upload
 * gets a new URL, so browsers never show a cached older picture.
 */
export async function uploadAvatar(file: File) {
  const blob = await toSquareAvatar(file)
  const { url } = await api<{ url: string }>('/api/me/avatar', { method: 'PUT', body: blob })
  await unwrap(useAuthClient().updateUser({ image: url }))
  await refreshCurrentUser({ fresh: true })
}

/** Clears the user's profile image (including one from Google) and deletes stored avatars. */
export async function removeAvatar() {
  await unwrap(useAuthClient().updateUser({ image: null }))
  await refreshCurrentUser({ fresh: true })
  try {
    await api('/api/me/avatar', { method: 'DELETE' })
  } catch (e) {
    console.warn('Could not delete stored avatars', e)
  }
}
