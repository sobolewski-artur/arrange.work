/** Largest avatar accepted (the app resizes photos to 256×256 before upload, so they're far smaller). */
const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const TYPES: Record<string, string> = { 'image/webp': 'webp', 'image/png': 'png', 'image/jpeg': 'jpg' }

/**
 * PUT /api/me/avatar — body: the image itself, with its Content-Type.
 * Stores it under a new key (so browsers never show a cached older picture), deletes the
 * user's older ones and returns its public URL, which the app sets as the user's Neon Auth profile image.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const type = getHeader(event, 'content-type')?.split(';')[0]?.trim().toLowerCase() ?? ''
  const ext = TYPES[type]
  if (!ext) throw createError({ statusCode: 415, statusMessage: 'Use a WebP, PNG or JPEG image' })
  if (Number(getHeader(event, 'content-length') ?? 0) > MAX_AVATAR_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Image too large' })
  }
  const body = await readRawBody(event, false)
  if (!body?.length) badRequest('Empty image')
  if (body.length > MAX_AVATAR_BYTES) throw createError({ statusCode: 413, statusMessage: 'Image too large' })

  const key = `${user.uid}/${Date.now()}.${ext}`
  await putObject(AVATARS_BUCKET, key, body, type, 'public, max-age=31536000, immutable')
  try {
    await deleteObjectsByPrefix(AVATARS_BUCKET, `${user.uid}/`, key)
  } catch (e) {
    console.warn('Could not clean up old avatars', e)
  }
  return { url: publicObjectUrl(AVATARS_BUCKET, key) }
})
