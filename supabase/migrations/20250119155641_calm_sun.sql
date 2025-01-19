-- Drop existing view if it exists
DROP VIEW IF EXISTS contract_details_view;

-- Create view for contract details
CREATE OR REPLACE VIEW contract_details_view AS
SELECT 
  c.*,
  o.offer_human_id,
  o.offer_summary,
  opp.opportunity_name,
  opp.opportunity_human_id,
  cust.company_name as customer_name,
  u.name as deal_owner_name,
  pe.name as presales_engineer_name,
  (
    SELECT json_agg(json_build_object(
      'id', d.id,
      'name', d.name,
      'file_path', d.file_path,
      'file_type', d.file_type,
      'file_size', d.file_size,
      'created_at', d.created_at
    ))
    FROM contract_documents d
    WHERE d.contract_id = c.id
  ) as documents,
  (
    SELECT json_agg(json_build_object(
      'id', env.id,
      'name', env.name,
      'type', env.type,
      'license_duration_months', env.license_duration_months,
      'deployment_type', env.deployment_type,
      'components', (
        SELECT json_agg(json_build_object(
          'id', comp.id,
          'component_name', comp.component_name,
          'type', comp.type,
          'size', comp.size,
          'quantity', comp.quantity,
          'monthly_price', comp.monthly_price
        ))
        FROM offer_environment_components comp
        WHERE comp.environment_id = env.id
      )
    ))
    FROM offer_environments env
    WHERE env.offer_id = o.id
  ) as environments,
  (
    SELECT json_agg(json_build_object(
      'id', ss.id,
      'name', ss.name,
      'duration_months', ss.duration_months,
      'subcontractor_id', ss.subcontractor_id,
      'services', (
        SELECT json_agg(json_build_object(
          'id', s.id,
          'service_name', s.service_name,
          'manday_rate', s.manday_rate,
          'number_of_mandays', s.number_of_mandays,
          'profit_percentage', s.profit_percentage
        ))
        FROM offer_service_components s
        WHERE s.service_set_id = ss.id
      )
    ))
    FROM offer_service_sets ss
    WHERE ss.offer_id = o.id
  ) as service_sets
FROM contracts c
JOIN offer_records o ON c.offer_id = o.id
JOIN opportunity_records opp ON o.opportunity_id = opp.id
JOIN customers cust ON opp.customer_id = cust.id
JOIN users u ON opp.deal_owner_id = u.id
LEFT JOIN users pe ON o.presales_engineer_id = pe.id;