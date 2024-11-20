-- Create users table with the correct structure
CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY NOT NULL,
  "email" text NOT NULL,
  "username" text,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "profile_image_url" text
); 