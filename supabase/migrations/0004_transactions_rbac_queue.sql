create or replace function public.has_permission(required_permission text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and (r.permissions ->> required_permission = 'true' or r.permissions ->> '*' = 'true')
  );
$$;

create or replace function public.claim_job(p_worker_id text, p_job_type text default null)
returns setof public.job_queue
language plpgsql
security definer
set search_path = public
as $$
declare
  claimed public.job_queue;
begin
  update public.job_queue
  set status = 'failed', last_error = 'Lease expired', locked_at = null, locked_by = null
  where status = 'processing'
    and locked_at < timezone('utc', now()) - interval '10 minutes';

  select * into claimed
  from public.job_queue
  where status = 'pending'
    and available_at <= timezone('utc', now())
    and (p_job_type is null or job_type = p_job_type)
  order by created_at
  for update skip locked
  limit 1;

  if claimed.id is null then return; end if;
  update public.job_queue
  set status = 'processing', locked_at = timezone('utc', now()), locked_by = p_worker_id, attempt_count = attempt_count + 1
  where id = claimed.id
  returning * into claimed;
  return next claimed;
end;
$$;

create or replace function public.finish_job(p_job_id uuid, p_success boolean, p_error text default null)
returns public.job_queue
language sql
security definer
set search_path = public
as $$
  update public.job_queue
  set status = case when p_success then 'completed' else 'failed' end,
      last_error = p_error,
      completed_at = case when p_success then timezone('utc', now()) else null end,
      locked_at = null,
      locked_by = null
  where id = p_job_id
  returning *;
$$;

create or replace function public.confirm_report_transaction(
  p_report_id uuid,
  p_actor_id uuid,
  p_note text,
  p_broadcast_channel text default null,
  p_broadcast_message text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  report_row public.scam_reports;
  entity_row public.scam_entities;
  identifier_row public.entity_identifiers;
  normalized text;
  broadcast_row public.scam_broadcasts;
begin
  select * into report_row from public.scam_reports where id = p_report_id for update;
  if report_row.id is null then raise exception 'Report not found'; end if;
  if report_row.status in ('confirmed', 'rejected', 'duplicate', 'closed') then raise exception 'Report is already terminal'; end if;
  if not exists (select 1 from public.user_roles ur join public.roles r on r.id = ur.role_id where ur.user_id = p_actor_id and (r.permissions ->> 'reports.confirm' = 'true' or r.permissions ->> '*' = 'true')) then raise exception 'Permission denied'; end if;

  normalized := regexp_replace(lower(trim(report_row.target_name)), '[^a-z0-9@._+\-]', '', 'g');
  select * into identifier_row from public.entity_identifiers where identifier_type = report_row.target_type and normalized_value = normalized for update;
  if identifier_row.id is null then
    insert into public.scam_entities (entity_type, display_name, normalized_name, risk_level, risk_score, status, description, source_count, confirmed_report_count, first_seen_at, last_seen_at, created_by, reviewed_by, reviewed_at)
    values (report_row.target_type, report_row.target_name, normalized, case when greatest(report_row.risk_score, report_row.confidence_score) >= 70 then 'critical' when greatest(report_row.risk_score, report_row.confidence_score) >= 40 then 'high' else 'medium' end, greatest(report_row.risk_score, report_row.confidence_score), 'active', report_row.description, 1, 1, report_row.created_at, report_row.created_at, p_actor_id, p_actor_id, timezone('utc', now())) returning * into entity_row;
    insert into public.entity_identifiers (entity_id, identifier_type, identifier_value, normalized_value, is_primary) values (entity_row.id, report_row.target_type, report_row.target_name, normalized, true);
  else
    select * into entity_row from public.scam_entities where id = identifier_row.entity_id for update;
    update public.scam_entities set status = 'active', source_count = source_count + 1, confirmed_report_count = confirmed_report_count + 1, last_seen_at = report_row.created_at, reviewed_by = p_actor_id, reviewed_at = timezone('utc', now()) where id = entity_row.id returning * into entity_row;
  end if;

  update public.scam_reports set status = 'confirmed', admin_note = p_note, reviewed_by = p_actor_id, reviewed_at = timezone('utc', now()) where id = report_row.id;
  insert into public.review_actions (report_id, actor_id, action_type, from_status, to_status, note, metadata) values (report_row.id, p_actor_id, 'confirm', report_row.status, 'confirmed', p_note, jsonb_build_object('entity_id', entity_row.id));
  insert into public.audit_logs (actor_id, action, resource_type, resource_id, old_data, new_data) values (p_actor_id, 'report.confirm', 'scam_report', report_row.id, jsonb_build_object('status', report_row.status), jsonb_build_object('status', 'confirmed', 'entity_id', entity_row.id));
  if p_broadcast_channel is not null and p_broadcast_message is not null then
    insert into public.scam_broadcasts (entity_id, report_id, channel_type, channel_id, message_text, status) values (entity_row.id, report_row.id, 'telegram', p_broadcast_channel, p_broadcast_message, 'pending') returning * into broadcast_row;
    insert into public.job_queue (job_type, payload, status) values ('send_broadcast', jsonb_build_object('broadcast_id', broadcast_row.id), 'pending');
  end if;
  return jsonb_build_object('report_id', report_row.id, 'entity_id', entity_row.id, 'broadcast_id', broadcast_row.id);
end;
$$;
