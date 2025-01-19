/*
  # Create default admin user

  1. Changes
    - Insert default admin user with credentials:
      - Email: admin@mail.com
      - Password: password
      - Role: admin
    - User will be created with a predefined user_human_id for consistency

  Note: Password will be stored as plaintext initially since Supabase Auth will handle the actual authentication
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM users WHERE email = 'admin@mail.com'
  ) THEN
    INSERT INTO users (
      name,
      email,
      role,
      password,
      user_human_id
    ) VALUES (
      'Admin User',
      'admin@mail.com',
      'admin',
      'password',
      'ADM00001'
    );
  END IF;
END $$;