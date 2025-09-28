// src/routes/api/analyze/+server.ts
// API endpoint that forwards requests to your Go backend

import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// Your Go backend URL - update this to match your setup
const GO_BACKEND_URL = 'http://localhost:8888';

export const POST: RequestHandler = async ({ request }) => {
  try {
    // GET the form data from the frontend
    const formData = await request.formData();
    
    // foreward request to Go backend
    const response = await fetch(`${GO_BACKEND_URL}/api/analyze`, {
      method: 'POST',
      body: formData,
      // Forward any headers if needed
      headers: {
        // Don't set Content-Type - let fetch handle multipart boundary
      }
    });
    
    if (!response.ok) {
      throw new Error(`Go backend error: ${response.status} ${response.statusText}`);
    }
    
    // GET response from lukes 
    const result = await response.json();
    
    return json({
      success: true,
      data: result
    });
    
  } catch (err) {
    console.error('API error:', err);
    
    return json({
      success: false,
      error: err instanceof Error ? err.message : 'Analysis failed'
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