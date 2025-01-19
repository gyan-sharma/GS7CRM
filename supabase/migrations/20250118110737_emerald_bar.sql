/*
  # Add Project Services to Offers

  1. New Tables
    - `offer_service_sets`
      - Basic info (id, offer_id, name)
      - Duration in months
      - Subcontractor selection (partner_id)
      - Services summary
      - Created/updated timestamps
    
    - `offer_service_components`
      - Links to service_set
      - Service details (name, manday_rate)
      - Number of mandays
      - Profit percentage
      - Total cost calculation
      - Created/updated timestamps

  2. Changes
    - Added tables for managing project services in offers
    - Added automatic total cost calculation
    - Added timestamps and triggers
*/

-- Create offer service sets table
CREATE TABLE IF NOT EXISTS offer_service_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid REFERENCES offer_records(id) ON DELETE CASCADE,
  service_set_human_id text NOT NULL,
  name text NOT NULL,
  duration_months integer NOT NULL CHECK (duration_months > 0),
  subcontractor_id uuid REFERENCES partners(id),
  services_summary text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create offer service components table
CREATE TABLE IF NOT EXISTS offer_service_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_set_id uuid REFERENCES offer_service_sets(id) ON DELETE CASCADE,
  service_name text NOT NULL,
  manday_rate numeric NOT NULL CHECK (manday_rate >= 0),
  number_of_mandays integer NOT NULL CHECK (number_of_mandays > 0),
  profit_percentage numeric NOT NULL CHECK (profit_percentage >= 0),
  total_cost numeric GENERATED ALWAYS AS (manday_rate * number_of_mandays * (1 + profit_percentage / 100)) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_offer_service_sets_offer_id
  ON offer_service_sets(offer_id);

CREATE INDEX IF NOT EXISTS idx_offer_service_components_service_set_id
  ON offer_service_components(service_set_id);

-- Create updated_at trigger function for offer_service_sets
CREATE OR REPLACE FUNCTION update_offer_service_sets_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create updated_at trigger function for offer_service_components
CREATE OR REPLACE FUNCTION update_offer_service_components_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_offer_service_sets_timestamp
  BEFORE UPDATE ON offer_service_sets
  FOR EACH ROW
  EXECUTE FUNCTION update_offer_service_sets_updated_at();

CREATE TRIGGER update_offer_service_components_timestamp
  BEFORE UPDATE ON offer_service_components
  FOR EACH ROW
  EXECUTE FUNCTION update_offer_service_components_updated_at();