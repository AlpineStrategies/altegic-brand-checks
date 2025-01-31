-- Drop existing policies to start fresh
DROP POLICY IF EXISTS "Users can view their own brands" ON public.brands;
DROP POLICY IF EXISTS "Users can insert their own brands" ON public.brands;
DROP POLICY IF EXISTS "Users can update their own brands" ON public.brands;
DROP POLICY IF EXISTS "Users can delete their own brands" ON public.brands;

-- Enable RLS
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;

-- Create policies with explicit type casting
CREATE POLICY "Users can view their own brands"
ON public.brands FOR SELECT
USING (auth.uid()::text = user_id::text);

CREATE POLICY "Users can insert their own brands"
ON public.brands FOR INSERT
WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can update their own brands"
ON public.brands FOR UPDATE
USING (auth.uid()::text = user_id::text)
WITH CHECK (auth.uid()::text = user_id::text);

CREATE POLICY "Users can delete their own brands"
ON public.brands FOR DELETE
USING (auth.uid()::text = user_id::text);

-- Grant necessary permissions
GRANT ALL ON public.brands TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated; 