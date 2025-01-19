-- Drop existing view if it exists
DROP VIEW IF EXISTS active_environments_view;
DROP VIEW IF EXISTS environments_view;

-- Create view for all environments
CREATE OR REPLACE VIEW environments_view AS
WITH environment_components AS (
  SELECT 
    env.id as environment_id,
    COALESCE(
      json_agg(
        json_build_object(
          'id', comp.id,
          'component_name', comp.component_name,
          'type', comp.type,
          'size', comp.size,
          'quantity', comp.quantity,
          'monthly_price', comp.monthly_price
        )
      ) FILTER (WHERE comp.id IS NOT NULL),
      '[]'::json
    ) as components,
    COALESCE(SUM(comp.monthly_price * comp.quantity), 0) as total_mrr
  FROM offer_environments env
  LEFT JOIN offer_environment_components comp ON env.id = comp.environment_id
  GROUP BY env.id
)
SELECT 
  env.id,
  env.name,
  env.type,
  env.offer_id,
  o.offer_human_id,
  opp.id as opportunity_id,
  opp.opportunity_name,
  opp.opportunity_human_id,
  env.license_duration_months,
  env.deployment_type,
  c.id as contract_id,
  c.contract_human_id,
  c.status as contract_status,
  c.contract_start_date,
  c.contract_start_date + (env.license_duration_months || ' months')::interval as contract_end_date,
  cust.company_name as customer_name,
  COALESCE(ec.components, '[]'::json) as components,
  COALESCE(ec.total_mrr, 0) as total_mrr,
  env.created_at,
  env.updated_at
FROM offer_environments env
INNER JOIN offer_records o ON env.offer_id = o.id
LEFT JOIN contracts c ON o.id = c.offer_id
INNER JOIN opportunity_records opp ON o.opportunity_id = opp.id
INNER JOIN customers cust ON opp.customer_id = cust.id
LEFT JOIN environment_components ec ON env.id = ec.environment_id
ORDER BY env.created_at DESC;