-- ============================================================
-- Chavruta v1 — Supabase migration
-- Run in Supabase SQL editor or via supabase db push
-- ============================================================

-- pgvector (included free on Supabase)
create extension if not exists vector with schema extensions;

-- Isolated schema
create schema if not exists chavruta;

-- ============================================================
-- TABLES
-- ============================================================

-- Profiles
-- embedding is generated server-side from what_i_know + what_i_want
-- in_queue / queued_at replace a separate match_queue table for v1
create table chavruta.profiles (
  id                    uuid primary key references auth.users(id) on delete cascade,
  display_name          text not null,
  what_i_know           text not null,
  what_i_want           text not null,
  embedding             vector(768),          -- Nomic embed-text-v1.5 dimension
  stripe_customer_id    text unique,
  stripe_subscription_id text unique,
  subscription_status   text not null default 'inactive'
    check (subscription_status in ('active', 'inactive', 'canceled', 'past_due')),
  in_queue              boolean not null default false,
  queued_at             timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

-- Source texts — seeded manually by founder before launch
-- Do NOT build an auto-sourcing pipeline; this is a curation task
create table chavruta.source_texts (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  body_or_link text not null,
  topic_tag    text,
  added_at     timestamptz not null default now()
);

-- Sessions
-- status flow: pending → active → completed | no-show
-- slot negotiation: server proposes 3 slots (JSON array of ISO strings),
--   each user picks one; server resolves to the first overlapping slot
create table chavruta.sessions (
  id              uuid primary key default gen_random_uuid(),
  user_a          uuid not null references chavruta.profiles(id),
  user_b          uuid not null references chavruta.profiles(id),
  source_text_id  uuid references chavruta.source_texts(id),
  status          text not null default 'pending'
    check (status in ('pending', 'active', 'completed', 'no-show')),

  -- Acceptance
  accepted_a      boolean not null default false,
  accepted_b      boolean not null default false,

  -- Slot negotiation
  proposed_slots  jsonb not null default '[]',  -- ["2024-01-15T10:00:00Z", ...]
  slot_choice_a   text,                          -- ISO timestamp chosen by user_a
  slot_choice_b   text,                          -- ISO timestamp chosen by user_b

  -- Timing
  scheduled_at    timestamptz,
  started_at      timestamptz,
  ended_at        timestamptz,
  created_at      timestamptz not null default now()
);

-- Messages — one thread per session, plain text only
create table chavruta.messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references chavruta.sessions(id) on delete cascade,
  sender_id   uuid not null references chavruta.profiles(id),
  content     text not null check (length(content) > 0),
  created_at  timestamptz not null default now()
);

-- Feedback — one row per user per session, enforced by unique constraint
create table chavruta.feedback (
  id            uuid primary key default gen_random_uuid(),
  session_id    uuid not null references chavruta.sessions(id),
  user_id       uuid not null references chavruta.profiles(id),
  rating        integer not null check (rating between 1 and 5),
  what_emerged  text,
  created_at    timestamptz not null default now(),
  unique(session_id, user_id)
);

-- ============================================================
-- ROW LEVEL SECURITY
-- All inserts that happen server-side (matching, session creation)
-- use the service_role key, which bypasses RLS by default.
-- ============================================================

alter table chavruta.profiles    enable row level security;
alter table chavruta.source_texts enable row level security;
alter table chavruta.sessions    enable row level security;
alter table chavruta.messages    enable row level security;
alter table chavruta.feedback    enable row level security;

-- profiles: own row + any session partner
create policy "profiles_select_own"
  on chavruta.profiles for select
  using (auth.uid() = id);

create policy "profiles_select_partner"
  on chavruta.profiles for select
  using (
    exists (
      select 1 from chavruta.sessions s
      where s.status in ('pending', 'active', 'completed')
        and (
          (s.user_a = auth.uid() and s.user_b = chavruta.profiles.id)
          or
          (s.user_b = auth.uid() and s.user_a = chavruta.profiles.id)
        )
    )
  );

create policy "profiles_insert_own"
  on chavruta.profiles for insert
  with check (auth.uid() = id);

create policy "profiles_update_own"
  on chavruta.profiles for update
  using (auth.uid() = id);

-- source_texts: read-only for all authenticated users
create policy "source_texts_select"
  on chavruta.source_texts for select
  using (auth.role() = 'authenticated');

-- sessions: participants only
create policy "sessions_select"
  on chavruta.sessions for select
  using (user_a = auth.uid() or user_b = auth.uid());

create policy "sessions_update"
  on chavruta.sessions for update
  using (user_a = auth.uid() or user_b = auth.uid());

-- messages: participants of the parent session
create policy "messages_select"
  on chavruta.messages for select
  using (
    exists (
      select 1 from chavruta.sessions s
      where s.id = session_id
        and (s.user_a = auth.uid() or s.user_b = auth.uid())
    )
  );

create policy "messages_insert"
  on chavruta.messages for insert
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from chavruta.sessions s
      where s.id = session_id
        and (s.user_a = auth.uid() or s.user_b = auth.uid())
        and s.status = 'active'
    )
  );

-- feedback: own rows only, session must be completed
create policy "feedback_select_own"
  on chavruta.feedback for select
  using (user_id = auth.uid());

create policy "feedback_insert_own"
  on chavruta.feedback for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from chavruta.sessions s
      where s.id = session_id
        and (s.user_a = auth.uid() or s.user_b = auth.uid())
        and s.status = 'completed'
    )
  );

-- ============================================================
-- INDEXES
-- ============================================================

-- Vector similarity search (ivfflat — good for up to ~1M rows)
create index profiles_embedding_ivfflat
  on chavruta.profiles
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- Session lookups by participant
create index sessions_user_a_idx on chavruta.sessions (user_a, status);
create index sessions_user_b_idx on chavruta.sessions (user_b, status);
create index sessions_status_idx on chavruta.sessions (status);

-- Message fetch in chronological order per session
create index messages_session_chrono_idx
  on chavruta.messages (session_id, created_at asc);

-- Queue lookup
create index profiles_in_queue_idx
  on chavruta.profiles (in_queue, queued_at asc)
  where in_queue = true;

-- ============================================================
-- TRIGGERS
-- ============================================================

create or replace function chavruta.set_updated_at()
returns trigger
language plpgsql
security definer
set search_path = chavruta
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_updated_at
  before update on chavruta.profiles
  for each row execute function chavruta.set_updated_at();

-- ============================================================
-- HELPER FUNCTIONS (called from API routes via service role)
-- ============================================================

-- Returns the most recent pending/active session for a user
create or replace function chavruta.get_current_session(p_user_id uuid)
returns table (
  id              uuid,
  user_a          uuid,
  user_b          uuid,
  source_text_id  uuid,
  status          text,
  scheduled_at    timestamptz,
  started_at      timestamptz,
  ended_at        timestamptz
)
language sql
security definer
stable
set search_path = chavruta
as $$
  select id, user_a, user_b, source_text_id, status, scheduled_at, started_at, ended_at
  from chavruta.sessions
  where (user_a = p_user_id or user_b = p_user_id)
    and status in ('pending', 'active')
  order by created_at desc
  limit 1;
$$;

-- Returns profiles queued for matching (service role only)
create or replace function chavruta.get_queue()
returns setof chavruta.profiles
language sql
security definer
stable
set search_path = chavruta
as $$
  select * from chavruta.profiles
  where in_queue = true
  order by queued_at asc;
$$;

-- ============================================================
-- REALTIME
-- Enable realtime on messages so the session thread updates live
-- ============================================================

-- Run this after enabling realtime in Supabase dashboard:
-- alter publication supabase_realtime add table chavruta.messages;
-- alter publication supabase_realtime add table chavruta.sessions;
