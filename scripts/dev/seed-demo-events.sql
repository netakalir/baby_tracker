-- =====================================================================
-- Dev seed: two weeks of realistic demo events for one test user.
--
-- TEST PROJECT ONLY. Run in the Supabase Dashboard -> SQL Editor of the
-- *test* project. Never run against production.
--
-- Usage:
--   1. Sign up in the app and finish onboarding (family + child).
--   2. Put that user's email in v_email below.
--   3. Run the whole file.
--
-- What it does, for the user's first child (the one the app shows):
--   * Inserts sleep / feeding / diaper / mood events for today and the
--     previous 13 days (Asia/Jerusalem wall clock), skipping anything
--     that would end in the future (no running timers are created).
--   * Backdates the child's created_at by 15 days, because the Week and
--     Day comparison screens never offer days before the child existed.
--   * Tags every row with metadata.seed = 'demo'. Re-running first deletes
--     the previous demo rows, so the script is safe to run repeatedly.
--
-- To remove the demo data later (all demo rows in the project, every child;
-- the created_at backdate is left as is):
--   delete from public.events where metadata->>'seed' = 'demo';
-- =====================================================================

do $$
declare
  v_email constant text := 'PUT-EMAIL-HERE';
  v_days  constant int  := 14;
  v_zone  constant text := 'Asia/Jerusalem';

  v_user_id  uuid;
  v_child_id uuid;
  v_today    date := (now() at time zone v_zone)::date;
  v_deleted  int;
  v_inserted int;
begin
  select u.id
    into v_user_id
    from auth.users u
   where lower(u.email) = lower(v_email);

  if v_user_id is null then
    raise exception 'No user with email "%" in this project.', v_email;
  end if;

  -- Same child the app shows: the family's earliest-created child.
  select c.id
    into v_child_id
    from public.children c
    join public.family_members m on m.family_id = c.family_id
   where m.user_id = v_user_id
   order by c.created_at asc
   limit 1;

  if v_child_id is null then
    raise exception 'User "%" has no child yet. Finish onboarding in the app first.', v_email;
  end if;

  delete from public.events e
   where e.child_id = v_child_id
     and e.metadata->>'seed' = 'demo';
  get diagnostics v_deleted = row_count;

  update public.children
     set created_at = least(created_at, now() - make_interval(days => v_days + 1))
   where id = v_child_id;

  -- One day's routine as offsets (minutes after local midnight of that day).
  -- The night block starts at 19:30 and runs into the next morning; every
  -- item of a day shifts by the same 0-25 min so the days differ a little
  -- without ever overlapping the next day's morning.
  insert into public.events (child_id, type, start_time, end_time, created_by, metadata)
  select v_child_id,
         t.event_type,
         slot.start_at,
         slot.end_at,
         v_user_id,
         case
           when t.bottle_ml is not null then
             t.metadata || jsonb_build_object(
               'amount_ml', t.bottle_ml + day_vars.amount_delta,
               'entered', jsonb_build_object('value', t.bottle_ml + day_vars.amount_delta, 'unit', 'ml')
             )
           else coalesce(t.metadata, '{}'::jsonb)
         end || jsonb_build_object('seed', 'demo')
    from generate_series(0, v_days - 1) as d(days_ago)
   cross join lateral (
         select v_today - d.days_ago        as day,
                (d.days_ago * 7) % 26       as shift_min,
                (d.days_ago % 3) * 10       as amount_delta
         ) as day_vars
   cross join (values
         --  offset  duration  type        metadata                                                  bottle_ml  even_days_only
         (   390,      25,    'feeding',  '{"feeding_type": "breast", "side": "left"}'::jsonb,       null::int, false), -- 06:30
         (   420,    null,    'diaper',   null,                                                       null,      false), -- 07:00
         (   540,      75,    'sleep',    null,                                                       null,      false), -- 09:00 nap
         (   625,      20,    'feeding',  '{"feeding_type": "bottle"}'::jsonb,                        120,       false), -- 10:25
         (   650,    null,    'diaper',   null,                                                       null,      false), -- 10:50
         (   655,    null,    'mood',     '{"mood_level": 4}'::jsonb,                                 null,      false), -- 10:55
         (   765,      90,    'sleep',    null,                                                       null,      false), -- 12:45 nap
         (   860,      20,    'feeding',  '{"feeding_type": "breast", "side": "right"}'::jsonb,      null,      false), -- 14:20
         (   885,    null,    'diaper',   null,                                                       null,      false), -- 14:45
         (   960,    null,    'mood',     '{"mood_level": 3}'::jsonb,                                 null,      false), -- 16:00
         (   990,      30,    'sleep',    null,                                                       null,      true),  -- 16:30 short nap
         (  1030,      20,    'feeding',  '{"feeding_type": "bottle"}'::jsonb,                        150,       false), -- 17:10
         (  1110,    null,    'diaper',   null,                                                       null,      false), -- 18:30
         (  1140,      20,    'feeding',  '{"feeding_type": "breast", "side": "left"}'::jsonb,       null,      false), -- 19:00
         (  1170,     330,    'sleep',    null,                                                       null,      false), -- 19:30 -> 01:00
         (  1505,      20,    'feeding',  '{"feeding_type": "bottle"}'::jsonb,                        90,        false), -- 01:05 night feed
         (  1530,     270,    'sleep',    null,                                                       null,      false)  -- 01:30 -> 06:00
         ) as t(offset_min, duration_min, event_type, metadata, bottle_ml, even_days_only)
   -- Both ends are placed on the local wall clock (then converted), so a
   -- night that crosses a DST change still ends at its intended local time.
   cross join lateral (
         select (day_vars.day::timestamp
                   + make_interval(mins => t.offset_min + day_vars.shift_min)) at time zone v_zone as start_at,
                (day_vars.day::timestamp
                   + make_interval(mins => t.offset_min + day_vars.shift_min + t.duration_min)) at time zone v_zone as end_at
         ) as slot
   where (not t.even_days_only or d.days_ago % 2 = 0)
     and coalesce(slot.end_at, slot.start_at) <= now();
  get diagnostics v_inserted = row_count;

  raise notice 'Seeded % demo events for "%" (removed % old demo events).',
    v_inserted, v_email, v_deleted;
end
$$;
