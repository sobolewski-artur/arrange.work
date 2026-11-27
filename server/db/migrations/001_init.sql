-- Replaces the Firestore collections `jobs`, `jobs/{id}/applications` and `users`.
-- Users themselves are in Neon Auth (neon_auth.user); `owner` / `applicant` / `uid` hold their ids.
-- Access rules (formerly firestore.rules) are enforced by the API in server/api.

-- Per-user app state (formerly the users/{uid} document).
create table users (
  uid text primary key,
  -- Everything up to this time counts as read in the notifications dropdown.
  notifications_seen_at timestamptz
);

create table jobs (
  -- 20-character ids like Firestore's, so links to jobs moved from Firestore keep working.
  id text primary key,
  owner text not null,
  title text not null check (char_length(title) between 1 and 100),
  description text not null check (char_length(description) <= 5000),
  -- Lowercased, normalized tags (shared/utils/tags.ts).
  tags text[] not null default '{}' check (cardinality(tags) <= 5),
  -- ISO 3166-1 alpha-2; null only for jobs posted before countries existed.
  country text check (country ~ '^[A-Z]{2}$'),
  locations text[] not null default '{}' check (cardinality(locations) <= 10),
  -- `locations` lowercased with JavaScript's toLocaleLowerCase (by the API), for case-insensitive
  -- filtering that matches the client's lowercasing exactly.
  location_keys text[] not null default '{}',
  budget_amount bigint check (budget_amount > 0),
  budget_currency text check (budget_currency in ('PLN', 'EUR', 'USD')),
  status text not null default 'open' check (status in ('open')),
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  check ((budget_amount is null) = (budget_currency is null))
);

-- "My jobs" and "Find work", newest/oldest first; budget sorts reuse these for the filter.
create index jobs_owner_created_at on jobs (owner, created_at desc);
create index jobs_status_created_at on jobs (status, created_at desc);
-- Tag and city filters (`&&`, "contains any").
create index jobs_tags on jobs using gin (tags);
create index jobs_location_keys on jobs using gin (location_keys);

-- One application per user per job. Deleting a job deletes its applications.
create table applications (
  job_id text not null references jobs (id) on delete cascade,
  applicant text not null,
  -- The applicant's display name and email, shared with the job's owner.
  name text not null check (char_length(name) <= 100),
  email text not null,
  message text not null check (char_length(message) between 1 and 2000),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  -- When the owner accepted or rejected it; null while pending.
  decided_at timestamptz,
  primary key (job_id, applicant),
  check ((status = 'pending') = (decided_at is null))
);

-- "My applications" (newest first, optionally by status) and decision notifications.
create index applications_applicant_created_at on applications (applicant, created_at desc);
create index applications_applicant_decided_at on applications (applicant, decided_at desc) where decided_at is not null;
-- "New application" notifications: an owner's jobs' applications, newest first.
create index applications_job_created_at on applications (job_id, created_at desc);
