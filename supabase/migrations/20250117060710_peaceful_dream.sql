/*
  # Update License Pricing Constraints
  
  1. Changes
    - Drops unique constraint on pretty_name column
    - Adds composite unique constraint on (pretty_name, type, size)
  
  2. Purpose
    - Allows same component name with different type/size combinations
    - Prevents exact duplicates of the same component/type/size combination
*/

-- Drop the existing unique constraint on pretty_name
ALTER TABLE license_pricing DROP CONSTRAINT IF EXISTS license_pricing_pretty_name_key;

-- Add a new composite unique constraint
ALTER TABLE license_pricing 
  ADD CONSTRAINT license_pricing_name_type_size_key 
  UNIQUE (pretty_name, type, size);