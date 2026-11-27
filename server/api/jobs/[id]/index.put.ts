/** PUT /api/jobs/:id — replaces the editable fields of one of the user's jobs (404 if not theirs). */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const id = getRouterParam(event, 'id')
  const c = jobColumns(await readJobBody(event))
  const rows = await db()`
    update jobs set
      title = ${c.title}, description = ${c.description}, tags = ${c.tags}, country = ${c.country},
      locations = ${c.locations}, location_keys = ${c.locationKeys},
      budget_amount = ${c.budgetAmount}, budget_currency = ${c.budgetCurrency}, updated_at = now()
    where id = ${id} and owner = ${user.uid}
    returning id
  `
  if (!rows.length) notFound()
  setResponseStatus(event, 204)
  return null
})
