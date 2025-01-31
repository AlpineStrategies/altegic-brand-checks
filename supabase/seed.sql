-- Initial data for testing and development

-- Create a test user in auth.users first
INSERT INTO auth.users (id, email)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'test@example.com')
ON CONFLICT (id) DO NOTHING;

-- Create a test brand
INSERT INTO public.brands (id, name, user_id)
VALUES 
  ('00000000-0000-0000-0000-000000000000', 'Test Brand', '00000000-0000-0000-0000-000000000001')
ON CONFLICT (id) DO NOTHING;

-- Create a test analysis report
INSERT INTO public.analysis_reports (
  id,
  brand_id,
  material_file_path,
  score,
  user_id
)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000000',
  'test/path/file.pdf',
  85,
  '00000000-0000-0000-0000-000000000001'
)
ON CONFLICT (id) DO NOTHING;

-- Create test analysis issues
INSERT INTO public.analysis_issues (
  report_id,
  severity,
  category,
  description,
  recommendation
)
VALUES 
  (
    '00000000-0000-0000-0000-000000000002',  -- This matches the report_id we created above
    'High',
    'Brand Colors',
    'Incorrect color usage in primary elements',
    'Use approved brand colors from the style guide'
  ),
  (
    '00000000-0000-0000-0000-000000000002',  -- This matches the report_id we created above
    'Medium',
    'Typography',
    'Inconsistent font usage',
    'Apply brand fonts consistently across all materials'
  )
ON CONFLICT DO NOTHING; 