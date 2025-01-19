/*
  # Fix admin role handling

  1. Changes
    - Remove direct role setting in auth.users
    - Update metadata with correct role claims
    - Ensure admin user has proper authentication setup
*/

DO $$ 
DECLARE
  admin_id uuid := 'c9c60d12-5128-4d46-b8e8-e8c9c7f27a05';
  encrypted_pwd text;
BEGIN
  -- Generate encrypted password for 'password'
  encrypted_pwd := crypt('password', gen_salt('bf'));

  -- Update admin user in auth.users with correct metadata
  UPDATE auth.users 
  SET 
    encrypted_password = encrypted_pwd,
    role = 'authenticated',  -- This must be 'authenticated', not 'admin'
    raw_app_meta_data = jsonb_build_object(
      'provider', 'email',
      'providers', ARRAY['email'],
      'role', 'admin'
    ),
    raw_user_meta_data = jsonb_build_object(
      'role', 'admin'
    ),
    updated_at = now(),
    email_confirmed_at = now()  -- Ensure email is confirmed
  WHERE id = admin_id;

  -- Update admin user in public.users
  UPDATE public.users 
  SET 
    password = encrypted_pwd,
    updated_at = now()
  WHERE id = admin_id;
END $$;