<!-- src/routes/+page.svelte -->
<script lang="ts">
  import FileUpload from '$lib/components/FileUpload.svelte';
  import CodeDiff from '$lib/components/CodeDiff.svelte';

  let analysisResults: any = null;
  let isAnalyzing = false;
  let uploadedFileContent: string = '';
  let fileName: string = '';
  let showCodeDiff = false;
  let selectedIssue: any = null;
  let geminiFixCache: Map<string, any> = new Map();
  let isGeneratingFix = false;

  async function handleFileUpload(event: CustomEvent<{ file: File; content: string }>) {
    const { file, content } = event.detail;
    uploadedFileContent = content;
    fileName = file.name;
    isAnalyzing = true;
    analysisResults = null;
    showCodeDiff = false;

    const backendUrl = "http://localhost:8888/api/analyze";
    try {
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ file: content }),
      });
      if (!response.ok) {
        throw new Error('Failed to get analysis');
      }
      analysisResults = await response.json();
    } catch (err) {
      analysisResults = { error: err instanceof Error ? err.message : 'Unknown error' };
    } finally {
      isAnalyzing = false;
    }
  }

  function getSeverity(message: string): 'high' | 'medium' | 'low' {
    if (message.toLowerCase().includes('invalid') || message.toLowerCase().includes('critical')) {
      return 'high';
    }
    if (message.toLowerCase().includes('warning') || message.toLowerCase().includes('medium')) {
      return 'medium';
    }
    return 'low';
  }

  $: formattedIssues = analysisResults?.errors
    ? analysisResults.errors.map((err: any) => ({
        message: err.message,
        severity: getSeverity(err.message),
        line: err.line,
        column: err.column
      }))
    : [];

  function exportToJSON() {
    const exportData = {
      timestamp: new Date().toISOString(),
      summary: {
        totalIssues: formattedIssues.length,
        highSeverity: formattedIssues.filter((i: any) => i.severity === 'high').length,
        mediumSeverity: formattedIssues.filter((i: any) => i.severity === 'medium').length,
        lowSeverity: formattedIssues.filter((i: any) => i.severity === 'low').length
      },
      issues: formattedIssues
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-audit-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function exportToCSV() {
    const headers = ['Severity', 'Message', 'Line', 'Column'];
    const csvContent = [
      headers.join(','),
      ...formattedIssues.map((issue: any) => [
        issue.severity,
        `"${issue.message.replace(/"/g, '""')}"`,
        issue.line,
        issue.column
      ].join(','))
    ].join('\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `security-audit-${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async function generateGeminiSuggestedFix(issue: any): Promise<string> {
    const cacheKey = `${issue.line}-${issue.message}`;
    
    // Check cache first
    if (geminiFixCache.has(cacheKey)) {
      return geminiFixCache.get(cacheKey).fixedCode;
    }

    try {
      isGeneratingFix = true;
      
      // Determine language from filename
      const language = getLanguageFromFileName(fileName);
      
      const response = await fetch('/api/gemini-fix', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          originalCode: uploadedFileContent,
          issue: issue,
          fileName: fileName,
          language: language
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to generate fix: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success && result.data) {
        // Cache the result
        geminiFixCache.set(cacheKey, result.data);
        return result.data.fixedCode;
      } else {
        throw new Error(result.error || 'Failed to generate fix');
      }
    } catch (error) {
      console.error('Error generating Gemini fix:', error);
      // Fallback to simple fix
      return generateSimpleFallbackFix(issue);
    } finally {
      isGeneratingFix = false;
    }
  }

  function getLanguageFromFileName(fileName: string): string {
    const extension = fileName.split('.').pop()?.toLowerCase();
    const languageMap: Record<string, string> = {
      'js': 'javascript',
      'ts': 'typescript',
      'jsx': 'javascript',
      'tsx': 'typescript',
      'py': 'python',
      'java': 'java',
      'cpp': 'cpp',
      'c': 'c',
      'cs': 'csharp',
      'php': 'php',
      'rb': 'ruby',
      'go': 'go',
      'rs': 'rust',
      'html': 'html',
      'css': 'css',
      'sql': 'sql'
    };
    return languageMap[extension || ''] || 'javascript';
  }

  function generateSimpleFallbackFix(issue: any): string {
    const lines = uploadedFileContent.split('\n');
    const issueLineIndex = issue.line - 1;
    const fixedLines = [...lines];
    
    // Simple fallback fixes
    if (issue.message.toLowerCase().includes('sql injection')) {
      const originalLine = lines[issueLineIndex];
      if (originalLine.includes('query') || originalLine.includes('SELECT')) {
        fixedLines[issueLineIndex] = originalLine.replace(
          /["'].*?["']/g, 
          '? // Use parameterized query'
        );
      }
    } else if (issue.message.toLowerCase().includes('xss')) {
      const originalLine = lines[issueLineIndex];
      fixedLines[issueLineIndex] = originalLine + ' // TODO: Sanitize user input';
    } else if (issue.message.toLowerCase().includes('hardcoded')) {
      const originalLine = lines[issueLineIndex];
      fixedLines[issueLineIndex] = originalLine.replace(
        /password\s*=\s*["'].*?["']/gi,
        'password = process.env.PASSWORD // Use environment variable'
      );
    } else {
      const originalLine = lines[issueLineIndex];
      fixedLines[issueLineIndex] = originalLine + ' // TODO: Security issue - needs review';
    }
    
    return fixedLines.join('\n');
  }

  async function showDiffForIssue(issue: any) {
    selectedIssue = issue;
    showCodeDiff = true;
  }

  function closeDiff() {
    showCodeDiff = false;
    selectedIssue = null;
  }

  async function copyAllFixedCode() {
    if (!selectedIssue) return;
    
    try {
      const fixedCode = await generateGeminiSuggestedFix(selectedIssue);
      await navigator.clipboard.writeText(fixedCode);
      
      // Show success feedback
      const button = document.querySelector('.copy-all-btn');
      if (button) {
        const originalText = button.textContent;
        button.textContent = '✅ Copied!';
        setTimeout(() => {
          button.textContent = originalText;
        }, 2000);
      }
    } catch (err) {
      console.error('Failed to copy fixed code:', err);
    }
  }

  async function downloadAllFixedCode() {
    if (!selectedIssue) return;
    
    try {
      const fixedCode = await generateGeminiSuggestedFix(selectedIssue);
      const blob = new Blob([fixedCode], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      
      // Generate filename
      const baseName = fileName.split('.').slice(0, -1).join('.');
      const extension = fileName.split('.').pop();
      const fixedFileName = `${baseName}_fixed_complete.${extension}`;
      
      a.href = url;
      a.download = fixedFileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download fixed code:', err);
    }
  }

  async function generateAllFixes() {
    if (isGeneratingFix) return;
    
    isGeneratingFix = true;
    
    try {
      // Generate fixes for all issues concurrently
      const fixPromises = formattedIssues.map(issue => 
        generateGeminiSuggestedFix(issue).catch(err => {
          console.error(`Failed to generate fix for issue on line ${issue.line}:`, err);
          return generateSimpleFallbackFix(issue);
        })
      );
      
      await Promise.all(fixPromises);
      
      // Show success message or select first issue
      if (formattedIssues.length > 0) {
        selectedIssue = formattedIssues[0];
      }
      
    } catch (err) {
      console.error('Failed to generate all fixes:', err);
    } finally {
      isGeneratingFix = false;
    }
  }
</script>

<svelte:head>
  <title>AuditFix</title>
</svelte:head>

<main>
  <div class="container">
    <header>
      <div class="header-content">
        <img src="/black.png" alt="AuditFix Logo" class="logo">
        <h1>AuditFix</h1>
      </div>
      <p>Security at Roadrunner speed.</p>
      <p class="subheading">Smart AI, instant code repairs, no time wasted.</p>
    </header>

    <FileUpload on:fileUploaded={handleFileUpload} />

    {#if isAnalyzing}
      <div class="analyzing">
        <div class="spinner"></div>
        <p>AI is analyzing your code for security issues...</p>
      </div>
    {/if}

    {#if analysisResults}
      <div class="results">
        <div class="results-header">
          <h2>Analysis Results</h2>
          {#if formattedIssues.length > 0}
            <div class="export-buttons">
              <button on:click={exportToJSON}>Export JSON</button>
              <button on:click={exportToCSV}>Export CSV</button>
              <button class="view-all-btn" on:click={() => showCodeDiff = !showCodeDiff}>
                {showCodeDiff ? 'Hide' : 'View'} Code Comparison
              </button>
              {#if showCodeDiff && selectedIssue}
                <button class="copy-all-btn" on:click={copyAllFixedCode} disabled={isGeneratingFix}>
                  Copy All Fixed
                </button>
                <button class="download-all-btn" on:click={downloadAllFixedCode} disabled={isGeneratingFix}>
                  Download Fixed
                </button>
              {/if}
            </div>
          {/if}
        </div>
        {#if formattedIssues.length > 0}
          {#each formattedIssues as issue}
            <div class="issue {issue.severity}">
              <span class="severity">{issue.severity}</span>
              <span class="message">{issue.message}</span>
              <span class="line">Line {issue.line}, Col {issue.column}</span>
              <button 
                class="view-fix-btn" 
                on:click={() => showDiffForIssue(issue)}
                disabled={isGeneratingFix}
              >
                {#if isGeneratingFix && selectedIssue === issue}
                  <div class="small-spinner"></div>
                  Generating...
                {:else}
                  AI Fix
                {/if}
              </button>
            </div>
          {/each}
        {:else}
          <p>No issues found.</p>
        {/if}
      </div>
    {/if}

    {#if showCodeDiff && uploadedFileContent && formattedIssues.length > 0}
      <div class="code-diff-section">
        <div class="diff-header">
          <h2>Code Comparison</h2>
          <button class="close-diff-btn" on:click={closeDiff}>×</button>
        </div>
        
        {#if selectedIssue}
          <!-- Show specific issue diff -->
          {#if isGeneratingFix}
            <div class="generating-fix">
              <div class="spinner"></div>
              <p>AI is generating security fix suggestions...</p>
            </div>
          {:else}
            {#await generateGeminiSuggestedFix(selectedIssue)}
              <div class="generating-fix">
                <div class="spinner"></div>
                <p>AI is generating security fix suggestions...</p>
              </div>
            {:then suggestedFix}
              <CodeDiff 
                originalCode={uploadedFileContent}
                suggestedFix={suggestedFix}
                issue={selectedIssue}
                fileName={fileName}
              />
              {#if geminiFixCache.has(`${selectedIssue.line}-${selectedIssue.message}`)}
                <div class="fix-explanation">
                  <h4>AI Explanation:</h4>
                  <p>{geminiFixCache.get(`${selectedIssue.line}-${selectedIssue.message}`).explanation}</p>
                  {#if geminiFixCache.get(`${selectedIssue.line}-${selectedIssue.message}`).recommendations?.length > 0}
                    <h5>Additional Recommendations:</h5>
                    <ul>
                      {#each geminiFixCache.get(`${selectedIssue.line}-${selectedIssue.message}`).recommendations as rec}
                        <li>{rec}</li>
                      {/each}
                    </ul>
                  {/if}
                </div>
              {/if}
            {:catch error}
              <div class="error-message">
                <p>Failed to generate AI fix: {error.message}</p>
                <p>Showing fallback fix...</p>
              </div>
              <CodeDiff 
                originalCode={uploadedFileContent}
                suggestedFix={generateSimpleFallbackFix(selectedIssue)}
                issue={selectedIssue}
                fileName={fileName}
              />
            {/await}
          {/if}
        {:else}
          <!-- Show all issues with navigation -->
          <div class="issue-navigator">
            <div class="navigator-header">
              <p>Select an issue to view the suggested fix:</p>
              <button 
                class="generate-all-btn" 
                on:click={generateAllFixes}
                disabled={isGeneratingFix}
              >
                {#if isGeneratingFix}
                  <div class="small-spinner"></div>
                  Generating All...
                {:else}
                  🤖 Generate All Fixes
                {/if}
              </button>
            </div>
            <div class="issue-buttons">
              {#each formattedIssues as issue, index}
                <button 
                  class="issue-nav-btn {issue.severity}" 
                  on:click={() => selectedIssue = issue}
                >
                  Issue {index + 1} (Line {issue.line})
                  {#if geminiFixCache.has(`${issue.line}-${issue.message}`)}
                    <span class="fix-ready">✅</span>
                  {/if}
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  </div>
</main>

<style>
  main {
    background-color: #fefce8; /* cream background */
    min-height: 100vh;
    padding: 2rem 0;
  }

  .container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem 1rem;
    text-align: left;
  }

  header {
    text-align: center;
    margin-bottom: 3rem;
    padding-top: 2rem;
  }

  .header-content {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    margin-bottom: 1rem;
  }

  .logo {
    width: 80px;
    height: 80px;
    object-fit: contain;
  }

  h1 {
    font-size: 4rem;
    font-weight: 700;
    color: #1e293b;
    margin: 0;
    letter-spacing: -0.02em;
  }

  header p {
    font-size: 1.25rem;
    color: #64748b;
    margin-bottom: 2rem;
  }

  .analyzing {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 2rem;
    margin-top: 2rem;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: #f8fafc;
  }

  .spinner {
    width: 24px;
    height: 24px;
    border: 3px solid #f3f4f6;
    border-top: 3px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }

  .results {
    margin-top: 2rem;
    padding: 1.5rem;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: white;
  }

  .results-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .results h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
  }

  .export-buttons {
    display: flex;
    gap: 0.5rem;
  }

  .export-buttons button {
    padding: 0.5rem 1rem;
    background: #f59e0b;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    cursor: pointer;
  }

  .export-buttons button:hover {
    background: #f59e0b;
  }

  .view-all-btn {
    background: #10b981 !important;
  }

  .view-all-btn:hover {
    background: #059669 !important;
  }

  .copy-all-btn {
    background: #10b981 !important;
  }

  .copy-all-btn:hover {
    background: #059669 !important;
  }

  .copy-all-btn:disabled {
    background: #9ca3af !important;
    cursor: not-allowed;
  }

  .download-all-btn {
    background: #8b5cf6 !important;
  }

  .download-all-btn:hover {
    background: #7c3aed !important;
  }

  .download-all-btn:disabled {
    background: #9ca3af !important;
    cursor: not-allowed;
  }

  .file-name {
    font-size: 0.875rem;
    color: #64748b;
    margin-bottom: 1.5rem;
    padding: 0.5rem;
    background: #f8fafc;
    border-radius: 6px;
  }

  .issue {
    display: grid;
    grid-template-columns: auto 1fr auto auto;
    gap: 1rem;
    align-items: center;
    padding: 1rem;
    margin-bottom: 0.5rem;
    border-radius: 8px;
    border-left: 4px solid #e2e8f0;
  }

  .issue.high {
    background: #fef2f2;
    border-left-color: #ef4444;
  }

  .issue.medium {
    background: #fffbeb;
    border-left-color: #f59e0b;
  }

  .severity {
    font-size: 0.75rem;
    font-weight: 600;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    text-align: center;
    min-width: 60px;
  }

  .issue.high .severity {
    background: #ef4444;
    color: white;
  }

  .issue.medium .severity {
    background: #f59e0b;
    color: white;
  }

  .message {
    font-weight: 500;
    color: #1e293b;
  }

  .line {
    font-size: 0.875rem;
    color: #64748b;
    font-family: monospace;
  }

  .view-fix-btn {
    padding: 0.5rem 1rem;
    background: #8b5cf6;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 0.75rem;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .view-fix-btn:hover {
    background: #7c3aed;
  }

  .view-fix-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }

  .view-fix-btn {
    display: flex;
    align-items: center;
    gap: 0.25rem;
  }

  .small-spinner {
    width: 12px;
    height: 12px;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .code-diff-section {
    margin-top: 2rem;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    background: white;
    overflow: hidden;
  }

  .code-diff-section .diff-header {
    background: #f8fafc;
    padding: 1rem;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .code-diff-section .diff-header h2 {
    margin: 0;
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
  }

  .close-diff-btn {
    background: #ef4444;
    color: white;
    border: none;
    border-radius: 50%;
    width: 2rem;
    height: 2rem;
    font-size: 1.25rem;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .close-diff-btn:hover {
    background: #dc2626;
  }

  .issue-navigator {
    padding: 1.5rem;
  }

  .navigator-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    flex-wrap: wrap;
    gap: 1rem;
  }

  .navigator-header p {
    margin: 0;
    color: #64748b;
  }

  .generate-all-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.5rem 1rem;
    background: #6366f1;
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
  }

  .generate-all-btn:hover {
    background: #4f46e5;
  }

  .generate-all-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }

  .issue-buttons {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .issue-nav-btn {
    padding: 0.5rem 1rem;
    border: 2px solid #e2e8f0;
    background: white;
    border-radius: 6px;
    font-size: 0.875rem;
    cursor: pointer;
    transition: all 0.2s;
  }

  .issue-nav-btn:hover {
    background: #f8fafc;
  }

  .issue-nav-btn.high {
    border-color: #ef4444;
    color: #ef4444;
  }

  .issue-nav-btn.high:hover {
    background: #fef2f2;
  }

  .issue-nav-btn.medium {
    border-color: #f59e0b;
    color: #f59e0b;
  }

  .issue-nav-btn.medium:hover {
    background: #fffbeb;
  }

  .issue-nav-btn.low {
    border-color: #10b981;
    color: #10b981;
  }

  .issue-nav-btn.low:hover {
    background: #f0fdf4;
  }

  .issue-nav-btn {
    position: relative;
  }

  .fix-ready {
    position: absolute;
    top: -0.25rem;
    right: -0.25rem;
    font-size: 0.75rem;
    background: white;
    border-radius: 50%;
    padding: 0.125rem;
  }

  .generating-fix {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 1rem;
    padding: 3rem;
    background: #f8fafc;
    border-radius: 8px;
    margin: 1rem;
  }

  .generating-fix p {
    color: #64748b;
    font-style: italic;
  }

  .fix-explanation {
    background: #f0fdf4;
    border: 1px solid #10b981;
    border-radius: 8px;
    padding: 1.5rem;
    margin: 1rem;
  }

  .fix-explanation h4 {
    margin: 0 0 0.5rem 0;
    color: #065f46;
    font-size: 1rem;
    font-weight: 600;
  }

  .fix-explanation h5 {
    margin: 1rem 0 0.5rem 0;
    color: #065f46;
    font-size: 0.875rem;
    font-weight: 600;
  }

  .fix-explanation p {
    margin: 0 0 1rem 0;
    color: #064e3b;
    line-height: 1.5;
  }

  .fix-explanation ul {
    margin: 0;
    padding-left: 1.5rem;
  }

  .fix-explanation li {
    color: #064e3b;
    margin-bottom: 0.25rem;
  }

  .error-message {
    background: #fef2f2;
    border: 1px solid #ef4444;
    border-radius: 8px;
    padding: 1rem;
    margin: 1rem;
    color: #dc2626;
  }

  .error-message p {
    margin: 0 0 0.5rem 0;
  }

  .error-message p:last-child {
    margin: 0;
    font-weight: 500;
  }
</style>