import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Configuration, OpenAIApi } from 'https://esm.sh/openai@3.1.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json'
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: corsHeaders
    })
  }

  try {
    const { brandId, userId, brandBookPath, marketingMaterialPath } = await req.json()

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Download files from storage
    const [brandBookData, marketingMaterialData] = await Promise.all([
      supabaseClient.storage
        .from('documents')
        .download(brandBookPath),
      supabaseClient.storage
        .from('documents')
        .download(marketingMaterialPath)
    ]);

    if (!brandBookData.data || !marketingMaterialData.data) {
      throw new Error('Failed to download files');
    }

    // Process the files (implement your analysis logic here)
    // This is where you'd analyze the PDFs
    const analysisResults = await analyzeDocuments(brandBookData.data, marketingMaterialData.data);

    // Store results in database
    const { data, error } = await supabaseClient
      .from('compliance_reports')
      .insert({
        brand_id: brandId,
        user_id: userId,
        results: analysisResults,
        status: 'completed'
      })
      .select()
      .single();

    if (error) throw error;

    return new Response(
      JSON.stringify({ 
        message: 'Analysis completed',
        reports: [data]
      }),
      { headers: corsHeaders }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: corsHeaders, status: 500 }
    )
  }
})

async function analyzeDocuments(brandBookBlob: Blob, marketingMaterialBlob: Blob) {
  // Convert blobs to text
  const [brandBookText, marketingMaterialText] = await Promise.all([
    brandBookBlob.text(),
    marketingMaterialBlob.text()
  ]);

  // Initialize OpenAI
  const openai = new OpenAIApi(new Configuration({
    apiKey: Deno.env.get('OPENAI_API_KEY'),
  }));

  // Get analysis from OpenAI
  const completion = await openai.createChatCompletion({
    model: 'gpt-4',
    messages: [
      {
        role: 'system',
        content: `You are a brand compliance expert. Analyze brand guidelines and marketing materials 
                 for inconsistencies in fonts, colors, layout, logos, tone of voice, and other brand elements.
                 Provide detailed feedback with specific examples.`
      },
      {
        role: 'user',
        content: `Brand Guidelines:\n${brandBookText}\n\nMarketing Material:\n${marketingMaterialText}
                 \n\nAnalyze the marketing material for compliance with the brand guidelines.
                 Focus on: fonts, colors, layout, logo usage, imagery style, and tone of voice.
                 Provide a compliance score (0-100) and list specific issues with recommendations.
                 Format your response as JSON with the following structure:
                 {
                   "score": number,
                   "summary": string,
                   "issues": Array<{
                     severity: "High" | "Medium" | "Low",
                     category: string,
                     description: string,
                     recommendation: string
                   }>
                 }`
      }
    ],
    temperature: 0.7,
    max_tokens: 2000
  });

  const analysisText = completion.data.choices[0].message?.content;
  if (!analysisText) {
    throw new Error('Failed to get analysis from OpenAI');
  }

  try {
    const analysis = JSON.parse(analysisText);
    return {
      score: analysis.score,
      summary: analysis.summary,
      issues: analysis.issues,
      analyzed_at: new Date().toISOString(),
      status: 'completed'
    };
  } catch (error) {
    console.error('Error parsing OpenAI response:', error);
    throw new Error('Failed to parse analysis results');
  }
}

async function uploadFile(
  supabase: any,
  file: File,
  path: string
): Promise<string> {
  const { data, error } = await supabase.storage
    .from('brand-files')
    .upload(path, file, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (error) throw error
  return data.path
}

function parseAIResponse(content: string) {
  try {
    // For demo purposes, using static data
    // In production, parse the actual OpenAI response
    const score = Math.floor(Math.random() * 41) + 60
    const issues = [
      {
        severity: 'High',
        category: 'Font Usage',
        description: 'Incorrect font family used in headlines',
        recommendation: 'Replace current fonts with approved brand fonts',
      },
      {
        severity: 'Medium',
        category: 'Color Scheme',
        description: 'Secondary colors not matching brand palette',
        recommendation: 'Adjust colors to match approved brand colors',
      },
      {
        severity: 'Low',
        category: 'Layout',
        description: 'Inconsistent spacing between elements',
        recommendation: 'Apply consistent spacing according to brand guidelines',
      },
    ]
    return { score, issues }
  } catch (error) {
    console.error('Error parsing AI response:', error)
    throw new Error('Failed to parse AI response')
  }
}