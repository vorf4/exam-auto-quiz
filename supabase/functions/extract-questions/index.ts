import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to extract text using Gemini OCR
async function extractWithGemini(base64: string, mimeType: string, lovableApiKey: string): Promise<string> {
  const ocrResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
          content: 'You are an OCR expert. Extract ALL text from the provided image or PDF document. Preserve the exact formatting, structure, and order of the text. Include question numbers, options, and any other visible text.'
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
              text: 'Extract all text from this document using OCR. Maintain the original structure and formatting.'
            }
          ]
        }
      ],
    }),
  });

  if (!ocrResponse.ok) {
    const errorText = await ocrResponse.text();
    console.error('Gemini OCR error:', ocrResponse.status, errorText);
    throw new Error(`Gemini OCR failed: ${errorText}`);
  }

  const ocrData = await ocrResponse.json();
  return ocrData.choices[0].message.content;
}

// Helper function to process PDF with Filestack OCR
async function processPdfWithFilestack(base64Data: string, ocrApiKey: string): Promise<string> {
  console.log('Processing PDF with Filestack OCR...');
  
  // Convert base64 to Uint8Array
  const binaryString = atob(base64Data);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Upload to Filestack
  const uploadResponse = await fetch(`https://www.filestackapi.com/api/store/S3?key=${ocrApiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/pdf',
    },
    body: bytes,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    console.error('Filestack upload error:', errorText);
    throw new Error('Failed to upload PDF to Filestack');
  }

  const uploadData = await uploadResponse.json();
  const fileHandle = uploadData.handle;
  
  console.log('PDF uploaded to Filestack, handle:', fileHandle);

  // Use Filestack OCR to extract text
  const ocrResponse = await fetch(`https://cdn.filestackapi.com/output=format:json/${ocrApiKey}/${fileHandle}`);
  
  if (!ocrResponse.ok) {
    const errorText = await ocrResponse.text();
    console.error('Filestack OCR error:', errorText);
    throw new Error('Filestack OCR processing failed');
  }

  const ocrData = await ocrResponse.json();
  
  // Extract text from OCR response
  let extractedText = '';
  if (ocrData.text) {
    extractedText = ocrData.text;
  } else if (ocrData.ocr && ocrData.ocr.text) {
    extractedText = ocrData.ocr.text;
  } else if (Array.isArray(ocrData)) {
    extractedText = ocrData.map((item: any) => item.text || '').join('\n\n');
  }

  console.log('Filestack OCR extraction complete, text length:', extractedText.length);
  return extractedText;
}

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

    console.log('Step 1: Running OCR to extract text from document...');

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const ocrApiKey = Deno.env.get('OCR_API_KEY');
    
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const isPdf = filePath.toLowerCase().endsWith('.pdf');
    let extractedText = '';

    // Step 1: OCR - Extract all text
    if (isPdf && ocrApiKey) {
      // Use Filestack OCR for PDF files
      try {
        extractedText = await processPdfWithFilestack(base64, ocrApiKey);
      } catch (error) {
        console.error('Filestack OCR failed, falling back to Gemini:', error);
        // Fall back to Gemini if Filestack fails
        isPdf && (extractedText = await extractWithGemini(base64, mimeType, lovableApiKey));
      }
    } else {
      // Use Gemini for images or if Filestack key not configured
      extractedText = await extractWithGemini(base64, mimeType, lovableApiKey);
    }
    
    console.log('OCR extracted text length:', extractedText.length);
    console.log('Step 2: Parsing text to extract MCQs...');

    // Step 2: Parse the extracted text to identify MCQs
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
            content: `You are an expert at parsing exam questions from text. Extract ALL multiple-choice questions from the provided text. For each question, provide:
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
            content: `Here is the OCR-extracted text from an exam document. Parse it and extract all multiple-choice questions:\n\n${extractedText}`
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
    const questionsText = aiData.choices[0].message.content;
    
    console.log('AI response:', questionsText);

    let questions;
    try {
      // Remove markdown code blocks if present
      const cleanedText = questionsText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
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