/*
  # Fix admin authentication

  1. Changes
    - Update admin user's role in auth.users to 'admin'
    - Update admin user's password to match the login form
    - Add admin claims to admin user's metadata
*/

DO $$ 
DECLARE
  admin_id uuid := 'c9c60d12-5128-4d46-b8e8-e8c9c7f27a05';
  encrypted_pwd text;
BEGIN
  -- Generate encrypted password for 'password'
  encrypted_pwd := crypt('password', gen_salt('bf'));

  -- Update admin user in auth.users
  UPDATE auth.users 
  SET 
    encrypted_password = encrypted_pwd,
    role = 'admin',
    raw_app_meta_data = '{"provider": "email", "providers": ["email"], "role": "admin"}'::jsonb,
    raw_user_meta_data = '{"role": "admin"}'::jsonb,
    updated_at = now()
  WHERE id = admin_id;

  -- Update admin user in public.users
  UPDATE public.users 
  SET 
    password = encrypted_pwd,
    updated_at = now()
  WHERE id = admin_id;
END $$;