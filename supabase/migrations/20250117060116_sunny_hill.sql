/*
  # Disable License Pricing RLS
  
  1. Changes
    - Disables Row Level Security (RLS) on the license_pricing table
    - Drops existing RLS policies for the table
  
  2. Security
    - Removes access restrictions on the license_pricing table
    - All users will have full access to pricing data
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can read license_pricing" ON license_pricing;
DROP POLICY IF EXISTS "Admin users can modify license_pricing" ON license_pricing;

-- Disable RLS
ALTER TABLE license_pricing DISABLE ROW LEVEL SECURITY;