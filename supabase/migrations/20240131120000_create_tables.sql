-- Create storage bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('brand-files', 'brand-files', false)
ON CONFLICT (id) DO NOTHING;

-- Add storage policies
CREATE POLICY "Users can upload files"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'brand-files');

CREATE POLICY "Users can update their files"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'brand-files');

CREATE POLICY "Users can read their files"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'brand-files');

-- Create brands table first
CREATE TABLE IF NOT EXISTS public.brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create analysis_reports table
CREATE TABLE IF NOT EXISTS public.analysis_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id UUID NOT NULL REFERENCES public.brands(id) ON DELETE CASCADE,
    material_file_path TEXT NOT NULL,
    score INTEGER,
    user_id UUID NOT NULL REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create analysis_issues table
CREATE TABLE IF NOT EXISTS public.analysis_issues (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id UUID NOT NULL REFERENCES public.analysis_reports(id) ON DELETE CASCADE,
    severity TEXT NOT NULL,
    category TEXT NOT NULL,
    description TEXT NOT NULL,
    recommendation TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on all tables
ALTER TABLE public.brands ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.analysis_issues ENABLE ROW LEVEL SECURITY;

-- Add RLS policies for brands
CREATE POLICY "Users can view their own brands"
ON public.brands FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own brands"
ON public.brands FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own brands"
ON public.brands FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own brands"
ON public.brands FOR DELETE
USING (auth.uid() = user_id);

-- Add RLS policies for analysis_reports
CREATE POLICY "Users can view their own analysis reports"
ON public.analysis_reports FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own analysis reports"
ON public.analysis_reports FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own analysis reports"
ON public.analysis_reports FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Add RLS policies for analysis_issues
CREATE POLICY "Users can view their own analysis issues"
ON public.analysis_issues FOR SELECT
USING (
    auth.uid() IN (
        SELECT user_id 
        FROM public.analysis_reports 
        WHERE id = analysis_issues.report_id
    )
);

CREATE POLICY "Users can create analysis issues for their reports"
ON public.analysis_issues FOR INSERT
WITH CHECK (
    auth.uid() IN (
        SELECT user_id 
        FROM public.analysis_reports 
        WHERE id = report_id
    )
);

CREATE POLICY "Users can update analysis issues for their reports"
ON public.analysis_issues FOR UPDATE
USING (
    auth.uid() IN (
        SELECT user_id 
        FROM public.analysis_reports 
        WHERE id = report_id
    )
)
WITH CHECK (
    auth.uid() IN (
        SELECT user_id 
        FROM public.analysis_reports 
        WHERE id = report_id
    )
);
