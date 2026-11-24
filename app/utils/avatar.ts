import { updateProfile, type User } from 'firebase/auth'
import { deleteObject, getDownloadURL, listAll, ref as storageRef, uploadBytes } from 'firebase/storage'

/** Largest image file accepted before resizing (the uploaded avatar itself is much smaller). */
export const MAX_AVATAR_SOURCE_MB = 20

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

/** Deletes the user's stored avatars except `keepPath`. Failures are only logged. */
async function deleteOldAvatars(uid: string, keepPath?: string) {
  try {
    const { items } = await listAll(storageRef(useFirebaseStorage(), `avatars/${uid}`))
    await Promise.all(items.filter(item => item.fullPath !== keepPath).map(item => deleteObject(item)))
  } catch (e) {
    console.warn('Could not clean up old avatars', e)
  }
}

/**
 * Resizes `file`, uploads it to avatars/{uid}/ and sets it as the user's photoURL.
 * Each upload gets a new file name, so browsers never show a cached older picture.
 */
export async function uploadAvatar(user: User, file: File) {
  const blob = await toSquareAvatar(file)
  const ext = blob.type === 'image/webp' ? 'webp' : 'png'
  const fileRef = storageRef(useFirebaseStorage(), `avatars/${user.uid}/${Date.now()}.${ext}`)

  await uploadBytes(fileRef, blob, {
    contentType: blob.type,
    cacheControl: 'public, max-age=31536000, immutable'
  })
  await updateProfile(user, { photoURL: await getDownloadURL(fileRef) })
  refreshCurrentUser()
  await deleteOldAvatars(user.uid, fileRef.fullPath)
}

/** Clears the user's photoURL (including one from Google) and deletes stored avatars. */
export async function removeAvatar(user: User) {
  await updateProfile(user, { photoURL: null })
  refreshCurrentUser()
  await deleteOldAvatars(user.uid)
}
