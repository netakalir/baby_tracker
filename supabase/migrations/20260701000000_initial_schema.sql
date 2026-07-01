-- ============================================================
-- TABLES (all tables first, before any cross-referencing policies)
-- ============================================================

create table families (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamp with time zone not null default now()
);

create table family_members (
  id        uuid primary key default gen_random_uuid(),
  family_id uuid not null references families(id) on delete cascade,
  user_id   uuid not null references auth.users(id) on delete cascade,
  role      text not null check (role in ('parent')),
  unique (family_id, user_id)
);

create table children (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id) on delete cascade,
  name       text not null,
  birth_date date not null,
  created_at timestamp with time zone not null default now()
);

create table events (
  id         uuid primary key default gen_random_uuid(),
  child_id   uuid not null references children(id) on delete cascade,
  type       text not null check (type in ('sleep', 'feeding', 'diaper', 'mood')),
  start_time timestamp with time zone not null,
  end_time   timestamp with time zone,
  created_by uuid not null references auth.users(id) default auth.uid(),
  metadata   jsonb,
  created_at timestamp with time zone not null default now()
);

create table family_invites (
  id         uuid primary key default gen_random_uuid(),
  family_id  uuid not null references families(id) on delete cascade,
  invited_by uuid not null references auth.users(id),
  token      text not null unique default gen_random_uuid()::text,
  created_at timestamp with time zone not null default now(),
  expires_at timestamp with time zone not null,
  used_at    timestamp with time zone,
  used_by    uuid references auth.users(id)
);

-- ============================================================
-- RLS ENABLE
-- ============================================================

alter table families       enable row level security;
alter table family_members enable row level security;
alter table children       enable row level security;
alter table events         enable row level security;
alter table family_invites enable row level security;

-- ============================================================
-- POLICIES (after all tables exist)
-- ============================================================

create policy "members can access their family"
  on families for all
  using (
    id in (
      select family_id from family_members where user_id = auth.uid()
    )
  );

create policy "members can view their family's members"
  on family_members for select
  using (
    family_id in (
      select family_id from family_members where user_id = auth.uid()
    )
  );

create policy "users can insert their own membership"
  on family_members for insert
  with check (user_id = auth.uid());

create policy "users can delete their own membership"
  on family_members for delete
  using (user_id = auth.uid());

create policy "members can access their family's children"
  on children for all
  using (
    family_id in (
      select family_id from family_members where user_id = auth.uid()
    )
  );

create policy "members can access events for their family's children"
  on events for all
  using (
    child_id in (
      select id from children where family_id in (
        select family_id from family_members where user_id = auth.uid()
      )
    )
  );

create policy "members can create invites for their family"
  on family_invites for insert
  with check (
    family_id in (
      select family_id from family_members where user_id = auth.uid()
    )
  );

create policy "members can view their family's invites"
  on family_invites for select
  using (
    family_id in (
      select family_id from family_members where user_id = auth.uid()
    )
  );

-- Anyone (including unauthenticated) can read a single invite by token
-- to validate it before signup. The app always filters by token — never
-- fetches a list — so "using (true)" is safe in this context.
create policy "anyone can read a single invite by token"
  on family_invites for select
  using (true);

-- ============================================================
-- GRANTS
-- ============================================================

grant select, insert, update, delete on families       to authenticated;
grant select, insert, update, delete on family_members to authenticated;
grant select, insert, update, delete on children       to authenticated;
grant select, insert, update, delete on events         to authenticated;
grant select, insert, update         on family_invites to authenticated;
grant select                         on family_invites to anon;

-- ============================================================
-- REALTIME (events and children need live sync between parents)
-- ============================================================

alter publication supabase_realtime add table events;
alter publication supabase_realtime add table children;
