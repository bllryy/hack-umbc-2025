<!-- src/lib/components/CodeDiff.svelte -->
<script lang="ts">
  export let originalCode: string = '';
  export let suggestedFix: string = '';
  export let issue: any = null;
  export let fileName: string = '';

  let originalLines: string[] = [];
  let suggestedLines: string[] = [];

  $: {
    originalLines = originalCode.split('\n');
    suggestedLines = suggestedFix.split('\n');
  }

  function getLineClass(lineIndex: number, isOriginal: boolean): string {
    if (!issue) return '';
    
    const issueLineIndex = issue.line - 1; // Convert to 0-based index
    const contextRange = 3; // Show 3 lines before and after
    
    if (lineIndex === issueLineIndex) {
      return isOriginal ? 'issue-line original' : 'issue-line fixed';
    }
    
    if (Math.abs(lineIndex - issueLineIndex) <= contextRange) {
      return 'context-line';
    }
    
    return '';
  }

  function shouldShowLine(lineIndex: number): boolean {
    if (!issue) return true;
    
    const issueLineIndex = issue.line - 1;
    const contextRange = 10; // Show even more context for better navigation
    
    return Math.abs(lineIndex - issueLineIndex) <= contextRange;
  }

  async function copyFixedCode() {
    try {
      await navigator.clipboard.writeText(suggestedFix);
      // Show success feedback
      const button = document.querySelector('.copy-btn');
      if (button) {
        const originalText = button.textContent;
        button.textContent = '✅ Copied!';
        button.classList.add('copied');
        setTimeout(() => {
          button.textContent = originalText;
          button.classList.remove('copied');
        }, 2000);
      }
    } catch (err) {
      console.error('Failed to copy code:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = suggestedFix;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
    }
  }

  function downloadFixedCode() {
    const blob = new Blob([suggestedFix], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    
    // Generate filename
    const baseName = fileName.split('.').slice(0, -1).join('.');
    const extension = fileName.split('.').pop();
    const fixedFileName = `${baseName}_fixed.${extension}`;
    
    a.href = url;
    a.download = fixedFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
</script>

<div class="code-diff">
  <div class="diff-header">
    <h3>Code Comparison</h3>
    {#if fileName}
      <span class="file-name">{fileName}</span>
    {/if}
  </div>
  
  <div class="diff-container">
    <!-- Original Code Panel -->
    <div class="code-panel original">
      <div class="panel-header">
        <h4>Original Code</h4>
        <span class="issue-indicator">Issue on line {issue?.line}</span>
      </div>
      <div class="code-content">
        {#each originalLines as line, index}
          {#if shouldShowLine(index)}
            <div class="code-line {getLineClass(index, true)}">
              <span class="line-number">{index + 1}</span>
              <span class="line-content">{line || ' '}</span>
            </div>
          {/if}
        {/each}
      </div>
    </div>

    <!-- Suggested Fix Panel -->
    <div class="code-panel suggested">
      <div class="panel-header">
        <div class="panel-title">
          <h4>Suggested Fix</h4>
          <span class="fix-indicator">Fixed version</span>
        </div>
        <div class="action-buttons">
          <button class="action-btn copy-btn" on:click={copyFixedCode} title="Copy fixed code">
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
            </svg>
            Copy
          </button>
          <button class="action-btn download-btn" on:click={downloadFixedCode} title="Download fixed code">
            <svg class="icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
            </svg>
            Download
          </button>
        </div>
      </div>
      <div class="code-content">
        {#each suggestedLines as line, index}
          {#if shouldShowLine(index)}
            <div class="code-line {getLineClass(index, false)}">
              <span class="line-number">{index + 1}</span>
              <span class="line-content">{line || ' '}</span>
            </div>
          {/if}
        {/each}
      </div>
    </div>
  </div>

  {#if issue}
    <div class="issue-description">
      <strong>Issue:</strong> {issue.message}
    </div>
  {/if}
</div>

<style>
  .code-diff {
    margin: 1rem 0;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    background: white;
    overflow: hidden;
    width: 100%;
    max-width: none;
  }

  .diff-header {
    background: #f8fafc;
    padding: 1rem;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .diff-header h3 {
    margin: 0;
    font-size: 1.125rem;
    font-weight: 600;
    color: #1e293b;
  }

  .file-name {
    font-family: monospace;
    font-size: 0.875rem;
    color: #64748b;
    background: #e2e8f0;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
  }

  .diff-container {
    display: grid;
    grid-template-columns: 1fr 1fr;
    min-height: 500px;
    height: 70vh;
    max-height: 800px;
  }

  .code-panel {
    border-right: 1px solid #e2e8f0;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .code-panel.suggested {
    border-right: none;
  }

  .panel-header {
    background: #f1f5f9;
    padding: 0.75rem 1rem;
    border-bottom: 1px solid #e2e8f0;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .panel-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex: 1;
  }

  .panel-header h4 {
    margin: 0;
    font-size: 0.875rem;
    font-weight: 600;
    color: #475569;
  }

  .original .panel-header {
    background: #fef2f2;
  }

  .suggested .panel-header {
    background: #f0fdf4;
  }

  .issue-indicator {
    font-size: 0.75rem;
    color: #ef4444;
    font-weight: 500;
  }

  .fix-indicator {
    font-size: 0.75rem;
    color: #10b981;
    font-weight: 500;
  }

  .code-content {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 0.875rem;
    line-height: 1.5;
    overflow: auto;
    flex: 1;
    padding: 0.5rem 0;
    background: #fafafa;
    min-height: 0;
  }

  .code-line {
    display: flex;
    min-height: 1.5rem;
    border-bottom: 1px solid #f1f5f9;
    background: white;
  }

  .code-line:hover {
    background: #f8fafc;
  }

  .line-number {
    background: #f8fafc;
    color: #64748b;
    padding: 0 0.75rem;
    text-align: right;
    min-width: 3rem;
    border-right: 1px solid #e2e8f0;
    user-select: none;
    flex-shrink: 0;
  }

  .line-content {
    padding: 0 1rem;
    white-space: pre;
    flex: 1;
    min-width: 0;
    word-wrap: break-word;
    overflow-wrap: break-word;
  }

  .issue-line {
    background: #fef2f2;
  }

  .issue-line.original {
    background: #fef2f2;
    border-left: 3px solid #ef4444;
  }

  .issue-line.fixed {
    background: #f0fdf4;
    border-left: 3px solid #10b981;
  }

  .context-line {
    background: #fffbeb;
  }

  .issue-description {
    background: #f8fafc;
    padding: 1rem;
    border-top: 1px solid #e2e8f0;
    font-size: 0.875rem;
    color: #475569;
  }

  .action-buttons {
    display: flex;
    gap: 0.5rem;
    margin-left: 1rem;
  }

  .action-btn {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    padding: 0.375rem 0.75rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 4px;
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
  }

  .action-btn:hover {
    background: #2563eb;
    transform: translateY(-1px);
  }

  .action-btn:active {
    transform: translateY(0);
  }

  .copy-btn {
    background: #10b981;
  }

  .copy-btn:hover {
    background: #059669;
  }

  .copy-btn.copied {
    background: #047857;
  }

  .download-btn {
    background: #8b5cf6;
  }

  .download-btn:hover {
    background: #7c3aed;
  }

  .icon {
    width: 14px;
    height: 14px;
  }

  @media (max-width: 768px) {
    .diff-container {
      grid-template-columns: 1fr;
      height: auto;
      min-height: 600px;
    }

    .code-panel {
      border-right: none;
      border-bottom: 1px solid #e2e8f0;
      min-height: 300px;
    }

    .code-panel.suggested {
      border-bottom: none;
    }

    .diff-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .code-content {
      max-height: 300px;
    }

    .panel-header {
      flex-direction: column;
      align-items: flex-start;
      gap: 0.5rem;
    }

    .panel-title {
      width: 100%;
    }

    .action-buttons {
      margin-left: 0;
      width: 100%;
      justify-content: stretch;
    }

    .action-btn {
      flex: 1;
      justify-content: center;
    }
  }
</style>