/** POST /api/jobs — posts a job owned by the signed-in user. Returns its id. */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const c = jobColumns(await readJobBody(event))
  const id = newJobId()
  await db()`
    insert into jobs (id, owner, title, description, tags, country, city, city_key, budget_amount, budget_currency)
    values (${id}, ${user.uid}, ${c.title}, ${c.description}, ${c.tags}, ${c.country}, ${c.city}, ${c.cityKey}, ${c.budgetAmount}, ${c.budgetCurrency})
  `
  setResponseStatus(event, 201)
  return { id }
})
