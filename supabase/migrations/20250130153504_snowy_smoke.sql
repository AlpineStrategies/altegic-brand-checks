/*
  # Brand Analysis Schema

  1. New Tables
    - `brands`
      - `id` (uuid, primary key)
      - `name` (text)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
      - `user_id` (uuid, references auth.users)
      
    - `brand_guidelines`
      - `id` (uuid, primary key)
      - `brand_id` (uuid, references brands)
      - `file_path` (text)
      - `content` (text)
      - `created_at` (timestamp)
      - `version` (integer)
      - `active` (boolean)
      
    - `analysis_reports`
      - `id` (uuid, primary key)
      - `brand_id` (uuid, references brands)
      - `material_file_path` (text)
      - `score` (integer)
      - `created_at` (timestamp)
      - `user_id` (uuid, references auth.users)

    - `analysis_issues`
      - `id` (uuid, primary key)
      - `report_id` (uuid, references analysis_reports)
      - `severity` (text)
      - `category` (text)
      - `description` (text)
      - `recommendation` (text)

  2. Security
    - Enable RLS on all tables
    - Add policies for authenticated users to manage their own data
*/

-- Create brands table
CREATE TABLE IF NOT EXISTS brands (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users NOT NULL
);

ALTER TABLE brands ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own brands"
  ON brands
  USING (auth.uid() = user_id);

-- Create brand_guidelines table
CREATE TABLE IF NOT EXISTS brand_guidelines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES brands NOT NULL,
  file_path text NOT NULL,
  content text,
  created_at timestamptz DEFAULT now(),
  version integer DEFAULT 1,
  active boolean DEFAULT true,
  UNIQUE (brand_id, version)
);

ALTER TABLE brand_guidelines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage guidelines for their brands"
  ON brand_guidelines
  USING (EXISTS (
    SELECT 1 FROM brands
    WHERE brands.id = brand_guidelines.brand_id
    AND brands.user_id = auth.uid()
  ));

-- Create analysis_reports table
CREATE TABLE IF NOT EXISTS analysis_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  brand_id uuid REFERENCES brands NOT NULL,
  material_file_path text NOT NULL,
  score integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  user_id uuid REFERENCES auth.users NOT NULL
);

ALTER TABLE analysis_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own reports"
  ON analysis_reports
  USING (auth.uid() = user_id);

-- Create analysis_issues table
CREATE TABLE IF NOT EXISTS analysis_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id uuid REFERENCES analysis_reports NOT NULL,
  severity text NOT NULL,
  category text NOT NULL,
  description text NOT NULL,
  recommendation text NOT NULL
);

ALTER TABLE analysis_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage issues for their reports"
  ON analysis_issues
  USING (EXISTS (
    SELECT 1 FROM analysis_reports
    WHERE analysis_reports.id = analysis_issues.report_id
    AND analysis_reports.user_id = auth.uid()
  ));