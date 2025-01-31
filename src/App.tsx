import { useState, useEffect } from 'react';
import { FileUploader } from './components/FileUploader';
import { ComplianceReportView } from './components/ComplianceReportView';
import { FileUpload, ComplianceReport } from './types';
import { Loader2 } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { supabase } from './supabaseClient';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL!;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY!;
export const supabaseClient = createClient(supabaseUrl, supabaseKey);

function App() {
  const [brandBook, setBrandBook] = useState<FileUpload>({ file: null, preview: null });
  const [marketingMaterial, setMarketingMaterial] = useState<FileUpload>({ file: null, preview: null });

  // const [report, setReport] = useState<ComplianceReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);

  const [reports, setReports] = useState<ComplianceReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [processingStep, setProcessingStep] = useState<'idle' | 'uploading' | 'analyzing' | 'complete' | 'error'>('idle');
  const [progressMessage, setProgressMessage] = useState<string>('');

  const apiUrl = import.meta.env.VITE_API_URL;

  useEffect(() => {
    const initializeData = async () => {
      try {
        const { data: { user } } = await supabaseClient.auth.getUser();
        
        if (!user) {
          const { data: { user: newUser }, error: signUpError } = await supabaseClient.auth.signUp({
            email: `user_${Date.now()}@example.com`,
            password: `temp_${Date.now()}`
          });

          if (signUpError) throw signUpError;
          if (!newUser?.id) throw new Error('Failed to create user');
          
          setUserId(newUser.id);
        } else {
          setUserId(user.id);
        }
      } catch (err) {
        console.error('Auth error:', err);
        setError('Failed to initialize authentication');
      }
    };

    initializeData();
  }, []);

  const analyzeCompliance = async () => {
    try {
      // Initial validation for files and user state
      if (!brandBook.file || !marketingMaterial.file) {
        throw new Error('Please select both files');
      }

      if (!userId) {
        throw new Error('User authentication not initialized. Please try again.');
      }

      setIsLoading(true);
      setProcessingStep('uploading');
      setProgressMessage('Preparing files for upload...');
      setError(null);

      // Test auth first
      const { data: { session: testSession }, error: testError } = await supabaseClient.auth.getSession();
      const isAuthWorking = !!testSession && !testError;
      console.log('Auth test result:', isAuthWorking);

      if (!isAuthWorking) {
        throw new Error('Authentication test failed. Please refresh the page and try again.');
      }

      // Get current session with additional validation
      const { data: { session }, error: sessionError } = await supabaseClient.auth.getSession();
      if (sessionError) throw new Error(`Session error: ${sessionError.message}`);
      if (!session) throw new Error('No active session. Please refresh the page.');
      if (session.user.id !== userId) {
        throw new Error('User session mismatch. Please refresh the page.');
      }

      setProgressMessage('Creating brand record...');

      // Create brand with explicit session and validation
      const { data: brand, error: brandError } = await supabaseClient
        .from('brands')
        .insert({
          name: `Brand_${Date.now()}`, // More unique name
          user_id: session.user.id,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (brandError) {
        console.error('Brand creation error:', brandError);
        throw new Error(`Failed to create brand: ${brandError.message}`);
      }

      if (!brand || !brand.id) {
        throw new Error('Brand creation failed - no brand ID received');
      }

      console.log('Brand created successfully:', brand);
      setBrandId(brand.id);

      setProgressMessage('Uploading files to secure storage...');
      
      // Ensure clean file names for storage
      const sanitizedBrandBookName = brandBook.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      const sanitizedMarketingMaterialName = marketingMaterial.file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
      
      const brandBookPath = `brand-books/${brand.id}/${sanitizedBrandBookName}`;
      const marketingMaterialPath = `marketing-materials/${brand.id}/${sanitizedMarketingMaterialName}`;

      console.log('Starting file uploads...', { brandBookPath, marketingMaterialPath });
      
      const [brandBookUpload, marketingMaterialUpload] = await Promise.all([
        supabaseClient.storage
          .from('brand-files')
          .upload(brandBookPath, brandBook.file),
        supabaseClient.storage
          .from('brand-files')
          .upload(marketingMaterialPath, marketingMaterial.file)
      ]);

      if (brandBookUpload.error) {
        console.error('Brand book upload error:', brandBookUpload.error);
        throw brandBookUpload.error;
      }
      if (marketingMaterialUpload.error) {
        console.error('Marketing material upload error:', marketingMaterialUpload.error);
        throw marketingMaterialUpload.error;
      }

      console.log('Files uploaded successfully');
      setProgressMessage('Files uploaded successfully. Starting analysis...');

      // Start analysis with file paths
      const response = await fetch(`${apiUrl}/functions/v1/analyze-brand`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({
          brandId,
          userId,
          brandBookPath,
          marketingMaterialPath,
          brandBookName: brandBook.file.name,
          marketingMaterialName: marketingMaterial.file.name
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Analysis API error:', errorData);
        throw new Error(errorData.error || 'Analysis failed');
      }

      const data = await response.json();
      console.log('Analysis complete:', data);
      setProcessingStep('complete');
      setProgressMessage('Analysis complete!');
      setReports(data.reports || []);
    } catch (error) {
      console.error('Analysis error:', error);
      setError(error instanceof Error ? error.message : 'Failed to analyze files');
      setProcessingStep('error');
      setProgressMessage('');
    } finally {
      setIsLoading(false);
    }
  };

  // Update file handlers
  const handleBrandBookChange = (file: File | null) => {
    console.log('Brand Book selected:', file?.name);
    setBrandBook({ file, preview: file ? URL.createObjectURL(file) : null });
  };

  const handleMarketingMaterialChange = (file: File | null) => {
    console.log('Marketing Material selected:', file?.name);
    setMarketingMaterial({ file, preview: file ? URL.createObjectURL(file) : null });
  };

  // Separate analyze handler
  const handleAnalyzeClick = async () => {
    console.log('Analyze button clicked manually');
    if (!brandBook.file || !marketingMaterial.file) {
      setError('Please select both files');
      return;
    }
    await analyzeCompliance();
  };

  const getButtonText = () => {
    if (isLoading) {
      switch (processingStep) {
        case 'uploading':
          return 'Uploading Files...';
        case 'analyzing':
          return 'Analyzing...';
        default:
          return 'Processing...';
      }
    }
    return 'Analyze Files';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto py-12 px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">
          Brand Compliance Checker
        </h1>
        
        <div className="grid md:grid-cols-2 gap-6 mb-8">
          <div>
            <h2 className="text-lg font-semibold mb-4">Brand Book</h2>
            <FileUploader
              onFileSelect={handleBrandBookChange}
              accept=".pdf"
              label="Upload Brand Guide"
            />
            {brandBook.file && (
              <p className="mt-2 text-sm text-gray-600">
                Selected: {brandBook.file.name}
              </p>
            )}
          </div>
          
          <div>
            <h2 className="text-lg font-semibold mb-4">Marketing Material</h2>
            <FileUploader
              onFileSelect={handleMarketingMaterialChange}
              accept=".pdf"
              label="Upload Marketing Material"
            />
            {marketingMaterial.file && (
              <p className="mt-2 text-sm text-gray-600">
                Selected: {marketingMaterial.file.name}
              </p>
            )}
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
            <p className="font-medium">Error</p>
            <p className="text-sm">{error}</p>
          </div>
        )}

        {progressMessage && !error && (
          <div className="text-center py-6">
            <p className="text-gray-600">{progressMessage}</p>
          </div>
        )}

        <button 
          onClick={handleAnalyzeClick}
          disabled={isLoading || !brandBook.file || !marketingMaterial.file}
          className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {getButtonText()}
        </button>

        {isLoading && (
          <div className="text-center py-12">
            <Loader2 className="animate-spin h-8 w-8 mx-auto text-blue-600 mb-4" />
            <p className="text-gray-600">
              {processingStep === 'uploading' ? 'Uploading your files...' : 'Analyzing brand compliance...'}
            </p>
            <p className="text-sm text-gray-500 mt-2">This may take a few moments...</p>
          </div>
        )}
        {reports && (
          <ComplianceReportView reports={reports.map(report => ({...report, id: crypto.randomUUID()}))} />
        )}
      </div>
    </div>
  );
}

export default App;