/** DELETE /api/me/avatar — deletes the user's stored avatars. */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  await deleteObjectsByPrefix(AVATARS_BUCKET, `${user.uid}/`)
  setResponseStatus(event, 204)
  return null
})
