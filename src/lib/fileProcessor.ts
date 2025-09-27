// src/lib/fileProcessor.ts
// Simplified file processing for single file security analysis

export interface SecurityIssue {
  id: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  type: string;
  line_number?: number;
  description: string;
  suggestion: string;
  code_snippet?: string;
}

export interface AnalysisResult {
  file_name: string;
  status: 'success' | 'error';
  issues: SecurityIssue[];
  summary: {
    total_issues: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface ApiResponse {
  success: boolean;
  data?: AnalysisResult;
  error?: string;
}

// Check if file type is supported for analysis
export function isSupportedFileType(fileName: string): boolean {
  const supportedExtensions = [
    '.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.java', '.php', 
    '.rb', '.cs', '.cpp', '.c', '.rs', '.kt', '.json', '.yml', 
    '.yaml', '.env', '.html', '.css', '.scss'
  ];
  
  return supportedExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
}

// Send file to Go backend for analysis
export async function analyzeFile(file: File, content: string): Promise<AnalysisResult> {
  const formData = new FormData();
  
  // Create a new file with content
  const blob = new Blob([content], { type: 'text/plain' });
  const fileWithContent = new File([blob], file.name, { type: file.type });
  
  formData.append('file', fileWithContent);
  formData.append('file_name', file.name);
  formData.append('file_size', file.size.toString());
  
  try {
    const response = await fetch('/api/analyze', {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result: ApiResponse = await response.json();
    
    if (!result.success || !result.data) {
      throw new Error(result.error || 'Analysis failed');
    }
    
    return result.data;
    
  } catch (error) {
    console.error('Analysis error:', error);
    throw new Error(
      error instanceof Error ? error.message : 'Failed to analyze file'
    );
  }
}

// Validate file before analysis
export function validateFile(file: File): { valid: boolean; error?: string } {
  // Check file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    return { valid: false, error: 'File too large (max 5MB)' };
  }
  
  // Check if file type is supported
  if (!isSupportedFileType(file.name)) {
    return { valid: false, error: 'Unsupported file type' };
  }
  
  // Check if file is empty
  if (file.size === 0) {
    return { valid: false, error: 'File is empty' };
  }
  
  return { valid: true };
}