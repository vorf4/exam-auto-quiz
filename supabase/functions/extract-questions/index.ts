import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { filePath } = await req.json();
    
    if (!filePath) {
      return new Response(JSON.stringify({ error: 'File path is required' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Processing file:', filePath);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Download file from storage
    const { data: fileData, error: downloadError } = await supabase
      .storage
      .from('exam-files')
      .download(filePath);

    if (downloadError) {
      console.error('Download error:', downloadError);
      return new Response(JSON.stringify({ error: 'Failed to download file' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Convert file to base64 for AI processing
    const arrayBuffer = await fileData.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    
    // Process in chunks to avoid call stack overflow
    let binaryString = '';
    const chunkSize = 8192;
    for (let i = 0; i < uint8Array.length; i += chunkSize) {
      const chunk = uint8Array.subarray(i, i + chunkSize);
      binaryString += String.fromCharCode(...chunk);
    }
    const base64 = btoa(binaryString);
    
    // Determine MIME type
    const mimeType = filePath.toLowerCase().endsWith('.pdf') 
      ? 'application/pdf' 
      : filePath.toLowerCase().endsWith('.jpg') || filePath.toLowerCase().endsWith('.jpeg')
      ? 'image/jpeg'
      : 'image/png';

    console.log('Extracting questions using AI...');

    // Call Lovable AI to extract questions
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          {
            role: 'system',
            content: `You are an expert at extracting exam questions from documents. Extract ALL multiple-choice questions from the provided image or PDF. For each question, provide:
1. The question text
2. Four options (A, B, C, D)
3. The correct answer (A, B, C, or D)

Return ONLY a JSON array with this exact structure:
[
  {
    "question": "Question text here?",
    "options": ["Option A", "Option B", "Option C", "Option D"],
    "correctAnswer": "A"
  }
]

If you cannot find any questions, return an empty array [].
Do not include any markdown formatting or explanations, just the raw JSON array.`
          },
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${base64}`
                }
              },
              {
                type: 'text',
                text: 'Extract all multiple-choice questions from this document.'
              }
            ]
          }
        ],
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: 'AI credits depleted. Please add funds to continue.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      return new Response(JSON.stringify({ error: 'AI processing failed' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const aiData = await aiResponse.json();
    const extractedText = aiData.choices[0].message.content;
    
    console.log('AI response:', extractedText);

    // Parse the JSON response
    let questions;
    try {
      // Remove markdown code blocks if present
      const cleanedText = extractedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      questions = JSON.parse(cleanedText);
    } catch (parseError) {
      console.error('Failed to parse AI response:', parseError);
      return new Response(JSON.stringify({ error: 'Failed to parse extracted questions' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (!Array.isArray(questions)) {
      console.error('Invalid questions format:', questions);
      return new Response(JSON.stringify({ error: 'Invalid questions format' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Successfully extracted ${questions.length} questions`);

    return new Response(JSON.stringify({ questions }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in extract-questions function:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error occurred' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});