-- A job is now in one city (optional) instead of a list of cities.
-- Jobs keep their first city. `locations` / `location_keys` are left in place so the app
-- version before this one keeps working until the new one is deployed; nothing reads them now,
-- and a later migration can drop them.

alter table jobs add column city text check (char_length(city) between 1 and 80);
-- `city` lowercased with JavaScript's toLocaleLowerCase (by the API), for case-insensitive
-- filtering that matches the client's lowercasing exactly.
alter table jobs add column city_key text;
alter table jobs add check ((city is null) = (city_key is null));

update jobs set city = locations[1], city_key = location_keys[1] where cardinality(locations) > 0;

-- "Find work" country and city filter.
create index jobs_country_city_key on jobs (country, city_key);
