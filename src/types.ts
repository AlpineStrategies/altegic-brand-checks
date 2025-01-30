export interface ComplianceReport {
  score: number;
  issues: {
    severity: 'High' | 'Medium' | 'Low';
    category: string;
    description: string;
    recommendation: string;
  }[];
}

export interface FileUpload {
  file: File | null;
  preview: string | null;
}

export interface Brand {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
  user_id: string;
}

export interface BrandGuidelines {
  id: string;
  brand_id: string;
  file_path: string;
  content: string | null;
  created_at: string;
  version: number;
  active: boolean;
}

export interface AnalysisReport {
  id: string;
  brand_id: string;
  material_file_path: string;
  score: number;
  created_at: string;
  user_id: string;
  issues?: AnalysisIssue[];
}

export interface AnalysisIssue {
  id: string;
  report_id: string;
  severity: string;
  category: string;
  description: string;
  recommendation: string;
}