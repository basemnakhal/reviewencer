-- Add phone column to profiles (mirrors auth.users.phone)
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS phone text;
