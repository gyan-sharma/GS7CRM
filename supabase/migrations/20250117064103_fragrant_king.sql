/*
  # Add Services Table

  1. New Tables
    - `services`
      - `id` (uuid, primary key)
      - `name` (text, unique)
      - `category` (text)
      - `manday_rate` (numeric)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Initial Data
    - Inserts default services with categories and rates
*/

-- Create services table
CREATE TABLE IF NOT EXISTS services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  category text NOT NULL,
  manday_rate numeric NOT NULL DEFAULT 300,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_services_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_services_updated_at
  BEFORE UPDATE ON services
  FOR EACH ROW
  EXECUTE FUNCTION update_services_updated_at();

-- Insert core services
INSERT INTO services (name, category, manday_rate) VALUES
  ('Project Management', 'Core Services', 300),
  ('Solution Design', 'Core Services', 300),
  ('UI Design and Development', 'Core Services', 300),
  ('Front-End Development', 'Core Services', 300),
  ('Back-End Development', 'Core Services', 300),
  ('Blockchain BPaaS Development', 'Core Services', 300),
  ('Integrations', 'Core Services', 300);

-- Insert supporting services
INSERT INTO services (name, category, manday_rate) VALUES
  ('Quality Assurance (QA) & Testing', 'Supporting Services', 300),
  ('Deployment', 'Supporting Services', 300),
  ('Documentation', 'Supporting Services', 300),
  ('Training', 'Supporting Services', 300);

-- Insert ancillary services
INSERT INTO services (name, category, manday_rate) VALUES
  ('Support & Maintenance', 'Ancillary Services', 300),
  ('Iterations & Enhancements', 'Ancillary Services', 300),
  ('Risk Management', 'Ancillary Services', 300),
  ('Risk Buffer', 'Ancillary Services', 300);

-- Insert additional costs
INSERT INTO services (name, category, manday_rate) VALUES
  ('Travel Costs', 'Additional Costs', 300),
  ('Stay Costs', 'Additional Costs', 300);