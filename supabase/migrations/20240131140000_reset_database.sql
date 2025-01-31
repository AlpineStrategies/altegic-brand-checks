-- Drop everything first
DROP TABLE IF EXISTS public.brands CASCADE;
DROP TABLE IF EXISTS public.analysis_reports CASCADE;
DROP TABLE IF EXISTS public.analysis_issues CASCADE;

-- Recreate tables
CREATE TABLE public.brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- Create a very permissive policy for testing
CREATE POLICY "Allow all operations for authenticated users"
ON public.brands
AS PERMISSIVE
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant permissions
GRANT ALL ON public.brands TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Create test function
CREATE OR REPLACE FUNCTION public.test_auth()
RETURNS TABLE (
    is_authenticated boolean,
    user_id uuid,
    user_role text
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        auth.role() IS NOT NULL as is_authenticated,
        auth.uid() as user_id,
        auth.role() as user_role;
END;
$$;

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.test_auth() TO authenticated;

-- Insert test data
INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, aud, role)
VALUES (
    '70ab9d46-4e0d-41b8-a6be-485f659e60f2',
    'user_1738350044023@example.com',
    crypt('password123', gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}',
    '{"email":"user_1738350044023@example.com","email_verified":true,"phone_verified":false}',
    'authenticated',
    'authenticated'
) ON CONFLICT (id) DO NOTHING; 

SELECT * FROM pg_proc WHERE proname = 'test_auth'; 