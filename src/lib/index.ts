// place files you want to import through the `$lib` alias in this folder.
// src/lib/index.ts
// Main library exports for the security audit tool

// File processing functions
export {
  analyzeFile,
  validateFile,
  isSupportedFileType
} from './fileProcessor.ts';

// Type exports
export type {
  SecurityIssue,
  AnalysisResult,
  ApiResponse
} from './fileProcessor.ts';

// Component exports
export { default as FileUpload } from './components/FileUpload.svelte';