import React, { useState, useEffect } from 'react';
import { FileUploader } from './components/FileUploader';
import { ComplianceReportView } from './components/ComplianceReportView';
import { FileUpload, ComplianceReport } from './types';
import { Loader2 } from 'lucide-react';
import { supabase } from './lib/supabase';

function App() {
  const [brandBook, setBrandBook] = useState<FileUpload>({ file: null, preview: null });
  const [marketingMaterial, setMarketingMaterial] = useState<FileUpload>({ file: null, preview: null });
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [report, setReport] = useState<ComplianceReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [brandId, setBrandId] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    const initializeData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          const { data: { user: newUser }, error: signUpError } = await supabase.auth.signUp({
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
      } finally {
        setIsInitializing(false);
      }
    };

    initializeData();
  }, []);

  useEffect(() => {
    const createBrand = async () => {
      if (!userId) return;

      try {
        const { data: brand, error: brandError } = await supabase
          .from('brands')
          .insert({
            name: `Brand_${Date.now()}`,
            user_id: userId
          })
          .select()
          .single();

        if (brandError) throw brandError;
        if (!brand) throw new Error('Failed to create brand');

        setBrandId(brand.id);
      } catch (err) {
        console.error('Brand creation error:', err);
        setError('Failed to create brand');
      }
    };

    if (userId && !brandId && !isInitializing) {
      createBrand();
    }
  }, [userId, brandId, isInitializing]);

  const analyzeCompliance = async () => {
    if (!brandBook.file || !marketingMaterial.file || !brandId || !userId) {
      setError('Missing required data. Please try again.');
      return;
    }

    setIsAnalyzing(true);
    setError(null);

    const formData = new FormData();
    formData.append('brandBook', brandBook.file);
    formData.append('marketingMaterial', marketingMaterial.file);
    formData.append('brandId', brandId);
    formData.append('userId', userId);

    try {
      console.log('Starting analysis request...', {
        brandId,
        userId,
        brandBookName: brandBook.file.name,
        marketingMaterialName: marketingMaterial.file.name
      });

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-brand`, {
        method: 'POST',
        body: formData,
        headers: {
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        }
      });

      if (!response.ok) {
        let errorMessage = `Server error: ${response.status} ${response.statusText}`;
        try {
          const errorData = await response.json();
          console.error('Server response error:', errorData);
          errorMessage = errorData.error || errorMessage;
        } catch (parseError) {
          console.error('Failed to parse error response:', parseError);
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      console.log('Analysis completed successfully:', data);
      setReport(data);
    } catch (err: any) {
      console.error('Analysis error details:', {
        name: err.name,
        message: err.message,
        stack: err.stack,
        brandId,
        userId
      });
      setError(`Failed to analyze files: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
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
              onFileSelect={(file) => setBrandBook({ file, preview: URL.createObjectURL(file) })}
              label="Upload your brand guidelines PDF"
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
              onFileSelect={(file) => setMarketingMaterial({ file, preview: URL.createObjectURL(file) })}
              label="Upload the PDF to analyze"
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

        {brandBook.file && marketingMaterial.file && !isAnalyzing && !report && (
          <button
            onClick={analyzeCompliance}
            className="w-full py-3 px-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            disabled={!brandId || !userId || isInitializing}
          >
            {isInitializing ? 'Initializing...' : !brandId || !userId ? 'Preparing...' : 'Analyze Compliance'}
          </button>
        )}

        {isAnalyzing && (
          <div className="text-center py-12">
            <Loader2 className="animate-spin h-8 w-8 mx-auto text-blue-600 mb-4" />
            <p className="text-gray-600">Analyzing brand compliance...</p>
            <p className="text-sm text-gray-500 mt-2">This may take a few moments...</p>
          </div>
        )}

        {report && (
          <ComplianceReportView report={report} />
        )}
      </div>
    </div>
  );
}

export default App;