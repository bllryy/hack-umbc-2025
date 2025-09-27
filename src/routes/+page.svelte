<!-- src/routes/+page.svelte -->
<script lang="ts">
  import FileUpload from '$lib/components/FileUpload.svelte';

  let analysisResults: any = null;
  let isAnalyzing = false;

  async function handleFileUpload(event: CustomEvent<{ file: File; content: string }>) {
    const { content } = event.detail;
    isAnalyzing = true;
    analysisResults = null;

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
      analysisResults = { error: err.message };
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
</script>

<svelte:head>
  <title>AuditFix</title>
</svelte:head>

<main>
  <div class="container">

    <FileUpload on:fileUploaded={handleFileUpload} />

    {#if isAnalyzing}
      <div class="analyzing">
        <div class="spinner"></div>
        <p>AI is analyzing your code for security issues...</p>
      </div>
    {/if}

    {#if analysisResults}
      <div class="results">
        <h2>Analysis Results</h2>
        {#if formattedIssues.length > 0}
          {#each formattedIssues as issue}
            <div class="issue {issue.severity}">
              <span class="severity">{issue.severity}</span>
              <span class="message">{issue.message}</span>
              <span class="line">Line {issue.line}, Col {issue.column}</span>
            </div>
          {/each}
        {:else}
          <p>No issues found.</p>
        {/if}
      </div>
    {/if}
  </div>
</main>

<style>
  .container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem 1rem;
  }

  header {
    text-align: center;
    margin-bottom: 3rem;
  }

  h1 {
    font-size: 2.5rem;
    font-weight: 700;
    color: #1e293b;
    margin-bottom: 0.5rem;
  }

  header p {
    font-size: 1.125rem;
    color: #64748b;
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

  .results h2 {
    font-size: 1.5rem;
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 1rem;
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
    grid-template-columns: auto 1fr auto;
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
</style>