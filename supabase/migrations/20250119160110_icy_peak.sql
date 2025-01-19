-- Create view for active environments
CREATE OR REPLACE VIEW active_environments_view AS
WITH environment_components AS (
  SELECT 
    env.id as environment_id,
    json_agg(
      json_build_object(
        'id', comp.id,
        'component_name', comp.component_name,
        'type', comp.type,
        'size', comp.size,
        'quantity', comp.quantity,
        'monthly_price', comp.monthly_price
      )
    ) as components,
    SUM(comp.monthly_price * comp.quantity) as total_mrr
  FROM offer_environments env
  LEFT JOIN offer_environment_components comp ON env.id = comp.environment_id
  GROUP BY env.id
)
SELECT 
  env.id,
  env.name,
  env.type,
  env.license_duration_months,
  env.deployment_type,
  c.id as contract_id,
  c.contract_human_id,
  cust.company_name as customer_name,
  ec.components,
  ec.total_mrr
FROM offer_environments env
JOIN offer_records o ON env.offer_id = o.id
JOIN contracts c ON o.id = c.offer_id
JOIN opportunity_records opp ON o.opportunity_id = opp.id
JOIN customers cust ON opp.customer_id = cust.id
JOIN environment_components ec ON env.id = ec.environment_id
WHERE c.status = 'Active';