import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { config } from 'dotenv';
import { OpenAI } from 'openai';
import pdfParse from 'pdf-parse';
import { createClient } from '@supabase/supabase-js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load environment variables
config();

if (!process.env.OPENAI_API_KEY || !process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_ANON_KEY) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 3000;

// Configure multer to handle form data
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

// CORS configuration
app.use(cors());

// Add express.json middleware for parsing JSON bodies
app.use(express.json());

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Add error handling middleware
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: err.message
  });
});

async function parsePDF(buffer) {
  try {
    if (!Buffer.isBuffer(buffer)) {
      console.error('Invalid input type:', typeof buffer);
      throw new Error('Invalid input: Expected a Buffer');
    }

    console.log('Starting PDF parsing, buffer size:', buffer.length);
    const data = await pdfParse(buffer, {
      // Disable the version test that's causing the error
      version: null
    });
    
    if (!data || !data.text) {
      throw new Error('Failed to extract text from PDF');
    }

    console.log('PDF parsed successfully, text length:', data.text.length);
    return data.text;
  } catch (error) {
    console.error('PDF parsing error:', error);
    throw new Error('Failed to parse PDF file. Please ensure it is a valid PDF.');
  }
}

function parseAIResponse(content) {
  try {
    // For demo purposes, generate a structured response
    const score = Math.floor(Math.random() * 41) + 60; // Random score between 60-100
    const issues = [
      {
        severity: 'High',
        category: 'Font Usage',
        description: 'Incorrect font family used in headlines',
        recommendation: 'Replace current fonts with approved brand fonts'
      },
      {
        severity: 'Medium',
        category: 'Color Scheme',
        description: 'Secondary colors not matching brand palette',
        recommendation: 'Adjust colors to match approved brand colors'
      },
      {
        severity: 'Low',
        category: 'Layout',
        description: 'Inconsistent spacing between elements',
        recommendation: 'Apply consistent spacing according to brand guidelines'
      }
    ];
    return { score, issues };
  } catch (error) {
    console.error('Failed to parse AI response:', error);
    throw new Error('Failed to analyze compliance');
  }
}

async function uploadFile(buffer, path) {
  try {
    console.log('Starting file upload to Supabase storage:', path);
    console.log('File size:', buffer.length, 'bytes');

    // First, check if the bucket exists
    const { data: buckets, error: bucketsError } = await supabase
      .storage
      .listBuckets();
    
    console.log('Available buckets:', buckets?.map(b => b.name));
    
    if (bucketsError) {
      console.error('Error listing buckets:', bucketsError);
      throw bucketsError;
    }

    const bucketExists = buckets?.some(b => b.name === 'brand-files');
    if (!bucketExists) {
      console.log('Creating brand-files bucket...');
      const { error: createBucketError } = await supabase
        .storage
        .createBucket('brand-files', { public: false });
      
      if (createBucketError) {
        console.error('Error creating bucket:', createBucketError);
        throw createBucketError;
      }
      console.log('Bucket created successfully');
    }

    // Attempt the upload
    const { data, error } = await supabase.storage
      .from('brand-files')
      .upload(path, buffer, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (error) {
      console.error('Supabase upload error:', error);
      throw error;
    }

    console.log('File uploaded successfully:', data?.path);
    
    // Verify the upload by trying to get the file URL
    const { data: urlData, error: urlError } = await supabase.storage
      .from('brand-files')
      .createSignedUrl(data.path, 60); // 60 seconds expiry

    if (urlError) {
      console.error('Error getting signed URL:', urlError);
    } else {
      console.log('File accessible at signed URL:', urlData?.signedUrl);
    }

    return data.path;
  } catch (error) {
    console.error('File upload error:', error);
    throw new Error(`Failed to upload file: ${error.message}`);
  }
}

async function saveAnalysisReport(brandId, materialPath, report, userId) {
  try {
    console.log('Saving analysis report for brand:', brandId);
    const { data: reportData, error: reportError } = await supabase
      .from('analysis_reports')
      .insert({
        brand_id: brandId,
        material_file_path: materialPath,
        score: report.score,
        user_id: userId
      })
      .select()
      .single();

    if (reportError) {
      console.error('Error saving report:', reportError);
      throw reportError;
    }

    console.log('Report saved successfully:', reportData?.id);

    const issues = report.issues.map(issue => ({
      report_id: reportData.id,
      ...issue
    }));

    console.log('Saving analysis issues:', issues.length);
    const { error: issuesError } = await supabase
      .from('analysis_issues')
      .insert(issues);

    if (issuesError) {
      console.error('Error saving issues:', issuesError);
      throw issuesError;
    }

    console.log('Issues saved successfully');
    return reportData;
  } catch (error) {
    console.error('Database error:', error);
    throw new Error(`Failed to save analysis report: ${error.message}`);
  }
}

app.post('/api/analyze', upload.fields([
  { name: 'brandBook', maxCount: 1 },
  { name: 'marketingMaterial', maxCount: 1 }
]), async (req, res) => {
  try {
    console.log('Received analysis request');
    const files = req.files;
    const brandId = req.body.brandId;
    const userId = req.body.userId;
    
    console.log('Request details:', {
      brandId,
      userId,
      filesReceived: {
        brandBook: !!files?.brandBook?.[0],
        marketingMaterial: !!files?.marketingMaterial?.[0]
      }
    });

    if (!files?.brandBook?.[0]?.buffer || !files?.marketingMaterial?.[0]?.buffer) {
      return res.status(400).json({ 
        error: 'Both PDF files are required'
      });
    }

    if (!brandId || !userId) {
      return res.status(400).json({
        error: 'Brand ID and User ID are required'
      });
    }

    console.log('Starting file uploads...');
    // Upload files to Supabase Storage
    const [brandBookPath, materialPath] = await Promise.all([
      uploadFile(
        files.brandBook[0].buffer,
        `brands/${brandId}/guidelines/${Date.now()}.pdf`
      ),
      uploadFile(
        files.marketingMaterial[0].buffer,
        `brands/${brandId}/materials/${Date.now()}.pdf`
      )
    ]);
    console.log('Files uploaded successfully');

    console.log('Parsing PDFs...');
    // Extract text from PDFs
    const [brandBookText, marketingMaterialText] = await Promise.all([
      parsePDF(files.brandBook[0].buffer),
      parsePDF(files.marketingMaterial[0].buffer)
    ]);
    console.log('PDFs parsed successfully');

    console.log('Saving brand guidelines...');
    // Save brand guidelines content
    const { error: guidelinesError } = await supabase
      .from('brand_guidelines')
      .insert({
        brand_id: brandId,
        file_path: brandBookPath,
        content: brandBookText,
        active: true
      });

    if (guidelinesError) {
      console.error('Error saving guidelines:', guidelinesError);
      throw guidelinesError;
    }
    console.log('Brand guidelines saved successfully');

    console.log('Starting OpenAI analysis...');
    // Analyze with OpenAI
    const analysis = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: "You are a brand compliance expert. Analyze the provided brand guidelines and marketing material for inconsistencies in fonts, colors, layout, and other brand elements."
        },
        {
          role: "user",
          content: `Brand Guidelines:\n${brandBookText}\n\nMarketing Material:\n${marketingMaterialText}\n\nAnalyze the marketing material for compliance with the brand guidelines. Focus on fonts, colors, layout, and logo usage. Provide a compliance score and list specific issues with recommendations.`
        }
      ]
    });
    console.log('OpenAI analysis completed');

    const report = parseAIResponse(analysis.choices[0].message.content);
    console.log('Saving analysis report...');
    const savedReport = await saveAnalysisReport(brandId, materialPath, report, userId);
    
    console.log('Analysis completed successfully');
    res.json({
      ...report,
      id: savedReport.id,
      created_at: savedReport.created_at
    });
  } catch (error) {
    console.error('Analysis error:', error);
    res.status(500).json({ 
      error: error.message || 'Failed to analyze files'
    });
  }
});

// Start the server
const server = app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
  console.log(`Health check available at http://localhost:${port}/api/health`);
});

// Handle server errors
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use. Please choose a different port or stop the other process.`);
  } else {
    console.error('Server error:', error);
  }
  process.exit(1);
});

// Handle process termination
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});