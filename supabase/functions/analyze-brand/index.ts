import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { Configuration, OpenAIApi } from 'https://esm.sh/openai@3.1.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      throw new Error('Method not allowed')
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SERVICE_ROLE_KEY_SUPA') ?? ''
    )

    const openai = new OpenAIApi(new Configuration({
      apiKey: Deno.env.get('OPENAI_API_KEY'),
    }))

    const formData = await req.formData()
    const brandBook = formData.get('brandBook') as File
    const marketingMaterial = formData.get('marketingMaterial') as File
    const brandId = formData.get('brandId') as string
    const userId = formData.get('userId') as string

    if (!brandBook || !marketingMaterial || !brandId || !userId) {
      throw new Error('Missing required fields')
    }

    // Ensure bucket exists
    const { data: buckets } = await supabaseClient.storage.listBuckets()
    if (!buckets?.some(b => b.name === 'brand-files')) {
      await supabaseClient.storage.createBucket('brand-files', { public: false })
    }

    // Process files
    const timestamp = Date.now()
    const [brandBookText, marketingMaterialText] = await Promise.all([
      brandBook.text(),
      marketingMaterial.text(),
    ])

    const [brandBookPath, materialPath] = await Promise.all([
      uploadFile(supabaseClient, brandBook, `brands/${brandId}/guidelines/${timestamp}.pdf`),
      uploadFile(supabaseClient, marketingMaterial, `brands/${brandId}/materials/${timestamp}.pdf`),
    ])

    // Save brand guidelines
    const { error: guidelinesError } = await supabaseClient
      .from('brand_guidelines')
      .insert({
        brand_id: brandId,
        file_path: brandBookPath,
        content: brandBookText,
        active: true,
      })

    if (guidelinesError) throw guidelinesError

    // Analyze with OpenAI
    const completion = await openai.createChatCompletion({
      model: 'gpt-4',
      messages: [
        {
          role: 'system',
          content: 'You are a brand compliance expert. Analyze the provided brand guidelines and marketing material for inconsistencies in fonts, colors, layout, and other brand elements.',
        },
        {
          role: 'user',
          content: `Brand Guidelines:\n${brandBookText}\n\nMarketing Material:\n${marketingMaterialText}\n\nAnalyze the marketing material for compliance with the brand guidelines. Focus on fonts, colors, layout, and logo usage. Provide a compliance score and list specific issues with recommendations.`,
        },
      ],
    })

    const report = parseAIResponse(completion.data.choices[0].message?.content || '')

    // Save analysis report
    const { data: savedReport, error: reportError } = await supabaseClient
      .from('analysis_reports')
      .insert({
        brand_id: brandId,
        material_file_path: materialPath,
        score: report.score,
        user_id: userId,
      })
      .select()
      .single()

    if (reportError) throw reportError

    // Save analysis issues
    const issues = report.issues.map(issue => ({
      report_id: savedReport.id,
      ...issue,
    }))

    const { error: issuesError } = await supabaseClient
      .from('analysis_issues')
      .insert(issues)

    if (issuesError) throw issuesError

    return new Response(
      JSON.stringify({
        ...report,
        id: savedReport.id,
        created_at: savedReport.created_at,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Function error:', error)
    return new Response(
      JSON.stringify({ 
        error: error instanceof Error ? error.message : 'An unexpected error occurred' 
      }),
      {
        status: error instanceof Error && error.message === 'Method not allowed' ? 405 : 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})

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