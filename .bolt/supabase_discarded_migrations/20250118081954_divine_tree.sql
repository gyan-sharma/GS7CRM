/*
  # Add sample pricing data

  1. New Data
    - Adds initial pricing data for different components with variations in type and size
  
  2. Changes
    - Inserts sample pricing records into license_pricing table
*/

-- Insert sample pricing data
INSERT INTO license_pricing (pretty_name, type, size, hourly_price) VALUES
  -- Blockchain Node
  ('Blockchain Node', 'Shared', 'Small', 0.50),
  ('Blockchain Node', 'Shared', 'Medium', 1.00),
  ('Blockchain Node', 'Shared', 'Large', 2.00),
  ('Blockchain Node', 'Dedicated', 'Small', 1.50),
  ('Blockchain Node', 'Dedicated', 'Medium', 3.00),
  ('Blockchain Node', 'Dedicated', 'Large', 6.00),

  -- API Gateway
  ('API Gateway', 'Shared', 'Small', 0.25),
  ('API Gateway', 'Shared', 'Medium', 0.50),
  ('API Gateway', 'Shared', 'Large', 1.00),
  ('API Gateway', 'Dedicated', 'Small', 0.75),
  ('API Gateway', 'Dedicated', 'Medium', 1.50),
  ('API Gateway', 'Dedicated', 'Large', 3.00),

  -- Storage Node
  ('Storage Node', 'Shared', 'Small', 0.30),
  ('Storage Node', 'Shared', 'Medium', 0.60),
  ('Storage Node', 'Shared', 'Large', 1.20),
  ('Storage Node', 'Dedicated', 'Small', 0.90),
  ('Storage Node', 'Dedicated', 'Medium', 1.80),
  ('Storage Node', 'Dedicated', 'Large', 3.60),

  -- IPFS Node
  ('IPFS Node', 'Shared', 'Small', 0.35),
  ('IPFS Node', 'Shared', 'Medium', 0.70),
  ('IPFS Node', 'Shared', 'Large', 1.40),
  ('IPFS Node', 'Dedicated', 'Small', 1.05),
  ('IPFS Node', 'Dedicated', 'Medium', 2.10),
  ('IPFS Node', 'Dedicated', 'Large', 4.20);