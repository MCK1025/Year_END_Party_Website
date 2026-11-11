-- Global disable_signup also blocks anonymous Auth. Keep it on and reject
-- permanent public registrations before insertion instead. app_metadata is
-- writable only by the Auth admin API; user_metadata never grants permission.
create function private.before_user_created(event jsonb) returns jsonb
language sql immutable set search_path='' as $$
  select case when coalesce(event #> '{user,is_anonymous}' = 'true'::jsonb,false)
    or coalesce(event #> '{user,app_metadata,party_admin_provisioning}' = 'true'::jsonb,false)
  then '{}'::jsonb else jsonb_build_object('error',jsonb_build_object(
    'http_code',403,'message','일반 회원가입은 허용되지 않습니다. 관리자에게 문의해주세요.')) end;
$$;
revoke all on function private.before_user_created(jsonb) from public,anon,authenticated;
grant usage on schema private to supabase_auth_admin;
grant execute on function private.before_user_created(jsonb) to supabase_auth_admin;
