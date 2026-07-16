-- Local development seed. Production roles/rules are inserted by the initial migration.
insert into public.scam_entities (
  entity_type, display_name, normalized_name, risk_level, risk_score, status, description, source_count, confirmed_report_count
) values (
  'domain', 'example-scam.test', 'example-scam.test', 'high', 65, 'active',
  'Synthetic development fixture. Do not use as real-world evidence.', 2, 1
)
on conflict do nothing;
