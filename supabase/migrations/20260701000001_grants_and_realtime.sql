-- Explicit GRANTs for all tables (required for Supabase API access)
grant select, insert, update, delete on families       to authenticated;
grant select, insert, update, delete on family_members to authenticated;
grant select, insert, update, delete on children       to authenticated;
grant select, insert, update, delete on events         to authenticated;
grant select, insert, update, delete on family_invites to authenticated;

-- Realtime publication on all 5 tables
alter publication supabase_realtime add table families;
alter publication supabase_realtime add table family_members;
alter publication supabase_realtime add table family_invites;
-- events and children were already added in the initial migration,
-- but adding them here is safe - Postgres ignores duplicates on publications.
