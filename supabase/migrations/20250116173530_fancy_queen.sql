/*
  # Disable RLS for users table

  1. Changes
    - Disable RLS on users table
    - Drop existing RLS policies
*/

-- Drop existing policies
DROP POLICY IF EXISTS "Admin users can read all users" ON users;
DROP POLICY IF EXISTS "Users can read own data" ON users;
DROP POLICY IF EXISTS "Admin users can create users" ON users;
DROP POLICY IF EXISTS "Admin users can update users" ON users;
DROP POLICY IF EXISTS "Admin users can delete users" ON users;

-- Disable RLS on users table
ALTER TABLE users DISABLE ROW LEVEL SECURITY;