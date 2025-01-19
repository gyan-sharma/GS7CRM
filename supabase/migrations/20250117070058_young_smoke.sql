/*
  # Create customers table

  1. New Tables
    - `customers`
      - Company Details:
        - `id` (uuid, primary key)
        - `company_name` (text, required)
        - `industry` (text, required)
        - `country` (text, required)
        - `region` (text, required)
        - `website` (text)
        - `number_of_employees` (text, required)
        - `company_human_id` (text, unique, required)
        - `hubspot_id` (text)
      - Contact Details:
        - `contact_person` (text, required)
        - `email` (text, required)
        - `phone` (text)
      - Timestamps:
        - `created_at` (timestamptz)
        - `updated_at` (timestamptz)

  2. Security
    - Enable RLS
    - Add policies for authenticated users
*/

-- Create customers table
CREATE TABLE IF NOT EXISTS customers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Company Details
  company_name text NOT NULL,
  industry text NOT NULL,
  country text NOT NULL,
  region text NOT NULL CHECK (region IN ('EMEA', 'JAPAC', 'AMERICAS')),
  website text,
  number_of_employees text NOT NULL,
  company_human_id text UNIQUE NOT NULL,
  hubspot_id text,
  -- Contact Details
  contact_person text NOT NULL,
  email text NOT NULL,
  phone text,
  -- Timestamps
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_customers_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_customers_updated_at
  BEFORE UPDATE ON customers
  FOR EACH ROW
  EXECUTE FUNCTION update_customers_updated_at();