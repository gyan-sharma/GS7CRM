/*
  # Contract Module Implementation

  1. New Tables
    - `contracts`
      - `id` (uuid, primary key)
      - `contract_human_id` (text, unique)
      - `offer_id` (uuid, references offer_records)
      - `contract_summary` (text)
      - `total_contract_value` (numeric)
      - `total_mrr` (numeric)
      - `total_services_revenue` (numeric)
      - `payment_terms` (text)
      - `contract_start_date` (date)
      - `status` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
      - `created_by` (uuid)
      - `updated_by` (uuid)

  2. Views
    - `contract_details_view` for easy access to contract details with related data
*/

-- Create contracts table
CREATE TABLE IF NOT EXISTS contracts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_human_id text UNIQUE NOT NULL,
  offer_id uuid REFERENCES offer_records(id) ON DELETE CASCADE,
  contract_summary text,
  total_contract_value numeric NOT NULL CHECK (total_contract_value >= 0),
  total_mrr numeric NOT NULL CHECK (total_mrr >= 0),
  total_services_revenue numeric NOT NULL CHECK (total_services_revenue >= 0),
  payment_terms text NOT NULL,
  contract_start_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('Draft', 'Active', 'Expired', 'Terminated')) DEFAULT 'Draft',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  created_by uuid REFERENCES users(id),
  updated_by uuid REFERENCES users(id)
);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_contracts_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger
CREATE TRIGGER update_contracts_timestamp
  BEFORE UPDATE ON contracts
  FOR EACH ROW
  EXECUTE FUNCTION update_contracts_updated_at();

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_contracts_offer_id
  ON contracts(offer_id);

CREATE INDEX IF NOT EXISTS idx_contracts_status
  ON contracts(status);

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