/*
  # Create License Pricing Table

  1. New Tables
    - `license_pricing`
      - `id` (uuid, primary key)
      - `pretty_name` (text, unique)
      - `type` (text)
      - `size` (text)
      - `hourly_price` (numeric)
      - `monthly_price` (numeric, computed)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `license_pricing` table
    - Add policies for authenticated users
*/

CREATE TABLE IF NOT EXISTS license_pricing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pretty_name text UNIQUE NOT NULL,
  type text NOT NULL,
  size text NOT NULL,
  hourly_price numeric NOT NULL CHECK (hourly_price >= 0),
  monthly_price numeric GENERATED ALWAYS AS (hourly_price * 730) STORED,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE license_pricing ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Authenticated users can read license_pricing"
  ON license_pricing
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin users can modify license_pricing"
  ON license_pricing
  FOR ALL
  TO authenticated
  USING (auth.jwt() ->> 'role' = 'admin')
  WITH CHECK (auth.jwt() ->> 'role' = 'admin');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_license_pricing_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_license_pricing_updated_at
  BEFORE UPDATE ON license_pricing
  FOR EACH ROW
  EXECUTE FUNCTION update_license_pricing_updated_at();