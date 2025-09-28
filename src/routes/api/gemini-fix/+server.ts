// src/routes/api/gemini-fix/+server.ts
// API endpoint for generating security fixes using Gemini AI

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { env } from '$env/dynamic/private';

// Gemini API configuration
const GEMINI_API_KEY = env.GEMINI_API_KEY || 'your-gemini-api-key-here';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

interface SecurityIssue {
  message: string;
  severity: string;
  line: number;
  column: number;
}

interface FixRequest {
  originalCode: string;
  issue: SecurityIssue;
  fileName: string;
  language?: string;
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { originalCode, issue, fileName, language = 'javascript' }: FixRequest = await request.json();
    
    if (!originalCode || !issue) {
      return json({ 
        success: false, 
        error: 'Missing required fields: originalCode or issue' 
      }, { status: 400 });
    }

    // Create a focused prompt for Gemini
    const prompt = `
You are a security expert. I have a security issue in my code that needs to be fixed.

**File:** ${fileName}
**Language:** ${language}
**Security Issue:** ${issue.message}
**Severity:** ${issue.severity}
**Line:** ${issue.line}

**Original Code:**
\`\`\`${language}
${originalCode}
\`\`\`

Please provide:
1. A fixed version of the ENTIRE code with the security issue resolved
2. A brief explanation of what was wrong and how you fixed it
3. Additional security recommendations if applicable

Requirements:
- Maintain the exact same functionality
- Fix only the security issue, don't change unrelated code structure
- Use best practices for ${language} security
- Provide working, production-ready code
- Keep the same variable names and function signatures where possible

Please respond in this JSON format:
{
  "fixedCode": "complete fixed code here",
  "explanation": "explanation of the fix",
  "recommendations": ["additional security tip 1", "additional security tip 2"]
}
`;

    // Call Gemini API
    const geminiResponse = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.1, // Low temperature for consistent, reliable fixes
          maxOutputTokens: 2048,
          topP: 0.8,
          topK: 10
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH", 
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      })
    });

    if (!geminiResponse.ok) {
      throw new Error(`Gemini API error: ${geminiResponse.status} ${geminiResponse.statusText}`);
    }

    const geminiData = await geminiResponse.json();
    
    if (!geminiData.candidates || geminiData.candidates.length === 0) {
      throw new Error('No response from Gemini');
    }

    const responseText = geminiData.candidates[0].content.parts[0].text;
    
    // Try to parse JSON response from Gemini
    let parsedResponse;
    try {
      // Extract JSON from response (Gemini sometimes wraps it in markdown)
      const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || responseText.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? (jsonMatch[1] || jsonMatch[0]) : responseText;
      parsedResponse = JSON.parse(jsonText);
    } catch (parseError) {
      // If JSON parsing fails, create a structured response
      parsedResponse = {
        fixedCode: originalCode, // Fallback to original
        explanation: responseText.substring(0, 500) + '...', // Truncate explanation
        recommendations: ["Review the generated fix carefully", "Test thoroughly before deployment"]
      };
    }

    return json({
      success: true,
      data: {
        fixedCode: parsedResponse.fixedCode || originalCode,
        explanation: parsedResponse.explanation || 'Security fix applied',
        recommendations: parsedResponse.recommendations || [],
        originalIssue: issue,
        generatedAt: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error('Gemini fix generation error:', err);
    
    return json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to generate security fix',
      fallback: true
    }, {
      status: 500
    });
  }
};

export const OPTIONS: RequestHandler = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
};