/*
  # Fix Environments View

  1. Changes
    - Drop existing view if it exists
    - Create new view that properly joins all required tables
    - Add proper handling for contract status filtering
    - Include all necessary environment and component information
    - Add proper aggregation for components and pricing
    - Ensure proper null handling in joins

  2. Improvements
    - Better performance through optimized joins
    - More accurate MRR calculations
    - Proper JSON aggregation for components
    - Better null handling
*/

-- Drop existing view if it exists
DROP VIEW IF EXISTS active_environments_view;

-- Create improved view for active environments
CREATE OR REPLACE VIEW active_environments_view AS
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
  env.license_duration_months,
  env.deployment_type,
  c.id as contract_id,
  c.contract_human_id,
  cust.company_name as customer_name,
  COALESCE(ec.components, '[]'::json) as components,
  COALESCE(ec.total_mrr, 0) as total_mrr,
  env.created_at,
  env.updated_at
FROM offer_environments env
INNER JOIN offer_records o ON env.offer_id = o.id
INNER JOIN contracts c ON o.id = c.offer_id
INNER JOIN opportunity_records opp ON o.opportunity_id = opp.id
INNER JOIN customers cust ON opp.customer_id = cust.id
LEFT JOIN environment_components ec ON env.id = ec.environment_id
WHERE c.status = 'Active'
ORDER BY env.created_at DESC;