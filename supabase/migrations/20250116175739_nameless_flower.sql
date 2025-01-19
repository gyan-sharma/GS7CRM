/*
  # Update admin user password

  1. Changes
    - Updates the admin user's password to be encrypted in both auth.users and public.users tables
    - Uses bcrypt for password encryption
    - Ensures password consistency across both tables

  2. Security
    - Uses secure password hashing
    - Updates both auth and application tables
*/

DO $$ 
DECLARE
  admin_id uuid := 'c9c60d12-5128-4d46-b8e8-e8c9c7f27a05';
  encrypted_pwd text;
BEGIN
  -- Generate encrypted password
  encrypted_pwd := crypt('password', gen_salt('bf'));

  -- Update password in auth.users
  UPDATE auth.users 
  SET encrypted_password = encrypted_pwd,
      updated_at = now()
  WHERE id = admin_id;

  -- Update password in public.users
  UPDATE public.users 
  SET password = encrypted_pwd,
      updated_at = now()
  WHERE id = admin_id;
END $$;