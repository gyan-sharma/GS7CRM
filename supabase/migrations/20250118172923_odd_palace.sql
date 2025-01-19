/*
  # Create offer environments tables

  1. New Tables
    - `offer_environments`
      - `id` (uuid, primary key)
      - `offer_id` (uuid, references offers)
      - `environment_human_id` (text)
      - `name` (text)
      - `type` (text)
      - `license_duration_months` (integer)
      - `deployment_type` (text)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
    
    - `offer_environment_components`
      - `id` (uuid, primary key)
      - `environment_id` (uuid, references environments)
      - `component_name` (text)
      - `type` (text)
      - `size` (text)
      - `quantity` (integer)
      - `monthly_price` (numeric)
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)
*/

-- Create offer environments table
CREATE TABLE IF NOT EXISTS offer_environments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id uuid REFERENCES offer_records(id) ON DELETE CASCADE,
  environment_human_id text NOT NULL,
  name text NOT NULL,
  type text NOT NULL,
  license_duration_months integer NOT NULL CHECK (license_duration_months > 0),
  deployment_type text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create offer environment components table
CREATE TABLE IF NOT EXISTS offer_environment_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id uuid REFERENCES offer_environments(id) ON DELETE CASCADE,
  component_name text NOT NULL,
  type text NOT NULL,
  size text NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  monthly_price numeric NOT NULL CHECK (monthly_price >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_offer_environments_offer_id
  ON offer_environments(offer_id);

CREATE INDEX IF NOT EXISTS idx_offer_environment_components_environment_id
  ON offer_environment_components(environment_id);

-- Create updated_at trigger function for offer_environments
CREATE OR REPLACE FUNCTION update_offer_environments_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create updated_at trigger function for offer_environment_components
CREATE OR REPLACE FUNCTION update_offer_environment_components_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers
CREATE TRIGGER update_offer_environments_timestamp
  BEFORE UPDATE ON offer_environments
  FOR EACH ROW
  EXECUTE FUNCTION update_offer_environments_updated_at();

CREATE TRIGGER update_offer_environment_components_timestamp
  BEFORE UPDATE ON offer_environment_components
  FOR EACH ROW
  EXECUTE FUNCTION update_offer_environment_components_updated_at();