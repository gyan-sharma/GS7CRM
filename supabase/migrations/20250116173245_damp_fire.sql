/*
  # Create admin user in auth system

  1. Changes
    - Create admin user in auth.users if not exists
    - Update the existing user in public.users to link with auth user
    
  Note: This ensures the user exists in both the auth system and our users table
*/

DO $$ 
DECLARE
  admin_id uuid := 'c9c60d12-5128-4d46-b8e8-e8c9c7f27a05';
BEGIN
  -- Only insert into auth.users if the email doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM auth.users WHERE email = 'admin@mail.com'
  ) THEN
    INSERT INTO auth.users (
      instance_id,
      id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      recovery_sent_at,
      last_sign_in_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    ) VALUES (
      '00000000-0000-0000-0000-000000000000',
      admin_id,
      'authenticated',
      'authenticated',
      'admin@mail.com',
      crypt('password', gen_salt('bf')),
      now(),
      now(),
      now(),
      '{"provider": "email", "providers": ["email"]}',
      '{}',
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
  END IF;

  -- Update the existing user in public.users to link with the auth user
  UPDATE public.users 
  SET id = admin_id
  WHERE email = 'admin@mail.com'
  AND id != admin_id;
END $$;