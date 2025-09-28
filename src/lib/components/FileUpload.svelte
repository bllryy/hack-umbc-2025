<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{ fileUploaded: { file: File; content: string } }>();

  let isDragOver = false;
  let isProcessing = false;
  let uploadedFile: File | null = null;
  let fileContent = '';
  let fileInput: HTMLInputElement;
  
  // GitHub functionality
  let activeTab: 'file' | 'github' = 'file';
  let githubUrl = '';
  let githubFiles: any[] = [];
  let selectedGithubFile: any = null;
  let isLoadingGithub = false;

  function handleDragOver(event: DragEvent) {
    event.preventDefault();
    isDragOver = true;
  }

  function handleDragLeave(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;
  }

  async function handleDrop(event: DragEvent) {
    event.preventDefault();
    isDragOver = false;
    isProcessing = true;
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  }

  async function handleFileInput(event: Event) {
    const target = event.target as HTMLInputElement;
    const files = target.files;
    if (files && files.length > 0) {
      isProcessing = true;
      await processFile(files[0]);
    }
  }

  async function processFile(file: File) {
    try {
      const content = await readFileAsText(file);
      uploadedFile = file;
      fileContent = content;
      dispatch('fileUploaded', { file, content });
    } catch (error) {
      alert('Error reading file. Please try again.');
    } finally {
      isProcessing = false;
    }
  }

  function readFileAsText(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsText(file);
    });
  }

  function clearFile() {
    uploadedFile = null;
    fileContent = '';
    githubFiles = [];
    selectedGithubFile = null;
    githubUrl = '';
  }

  function parseGitHubUrl(url: string): { owner: string; repo: string; branch?: string } | null {
    // Support different GitHub URL formats
    const patterns = [
      // https://github.com/owner/repo
      /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\/tree\/([^\/]+))?/,
      // github.com/owner/repo
      /^github\.com\/([^\/]+)\/([^\/]+)(?:\/tree\/([^\/]+))?/,
      // owner/repo
      /^([^\/]+)\/([^\/]+)$/
    ];

    for (const pattern of patterns) {
      const match = url.trim().match(pattern);
      if (match) {
        return {
          owner: match[1],
          repo: match[2],
          branch: match[3] || 'main'
        };
      }
    }
    return null;
  }

  async function fetchGitHubRepo() {
    if (!githubUrl.trim()) return;
    
    isLoadingGithub = true;
    githubFiles = [];
    
    try {
      const response = await fetch('/api/github-repo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ githubUrl })
      });
      
      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to fetch repository');
      }
      
      githubFiles = result.data.files;
      
      if (githubFiles.length === 0) {
        alert('No supported code files found in this repository.');
      }
      
    } catch (error) {
      console.error('GitHub fetch error:', error);
      alert(error instanceof Error ? error.message : 'Failed to fetch repository');
    } finally {
      isLoadingGithub = false;
    }
  }

  async function selectGitHubFile(file: any) {
    selectedGithubFile = file;
    isProcessing = true;
    
    try {
      // Fetch file content
      const contentUrl = `https://api.github.com/repos/${file.owner}/${file.repo}/contents/${file.path}?ref=${file.branch}`;
      const response = await fetch(contentUrl);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch file content: ${response.status}`);
      }
      
      const data = await response.json();
      const content = atob(data.content); // Decode base64 content
      
      // Create a virtual file object
      const virtualFile = new File([content], file.displayName, {
        type: 'text/plain'
      });
      
      uploadedFile = virtualFile;
      fileContent = content;
      
      dispatch('fileUploaded', { file: virtualFile, content });
      
    } catch (error) {
      console.error('File fetch error:', error);
      alert(error instanceof Error ? error.message : 'Failed to fetch file content');
    } finally {
      isProcessing = false;
    }
  }
</script>

<div class="upload-container">
  <!-- Tab Navigation -->
  <div class="tab-navigation">
    <button 
      class="tab-btn" 
      class:active={activeTab === 'file'}
      on:click={() => activeTab = 'file'}
    >
      Upload File
    </button>
    <button 
      class="tab-btn" 
      class:active={activeTab === 'github'}
      on:click={() => activeTab = 'github'}
    >
      GitHub Repository
    </button>
  </div>

  {#if !uploadedFile}
    {#if activeTab === 'file'}
      <div 
        class="drop-zone"
        class:drag-over={isDragOver}
        class:processing={isProcessing}
        on:dragover={handleDragOver}
        on:dragleave={handleDragLeave}
        on:drop={handleDrop}
        role="button"
        tabindex="0"
      >
      {#if isProcessing}
        <div class="processing">
          <div class="spinner"></div>
          <p>Reading file...</p>
        </div>
      {:else}
        <div class="drop-content">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14,2 14,8 20,8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10,9 9,9 8,9"/>
          </svg>
          <h3>Drop your code file here</h3>
          <p>or <button type="button" class="browse-link" on:click={() => fileInput.click()} aria-label="Browse files" on:keydown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); }}>browse files</button></p>
          <p class="file-types">Supports: .js, .ts, .py, .go, .java, .php, .rb, .cs, .cpp, .c, .rs, .kt</p>
        </div>
      {/if}
      <input 
        type="file" 
        accept=".js,.ts,.jsx,.tsx,.py,.go,.java,.php,.rb,.cs,.cpp,.c,.rs,.kt,.json,.yml,.yaml,.env"
        on:change={handleFileInput}
        hidden
        bind:this={fileInput}
      >
      </div>
    {:else if activeTab === 'github'}
      <div class="github-section">
        <div class="github-input">
          <h3>Enter GitHub Repository URL</h3>
          <div class="input-group">
            <input
              type="text"
              placeholder="https://github.com/owner/repo or owner/repo"
              bind:value={githubUrl}
              class="github-url-input"
              on:keydown={(e) => e.key === 'Enter' && fetchGitHubRepo()}
            />
            <button 
              class="fetch-btn"
              on:click={fetchGitHubRepo}
              disabled={isLoadingGithub || !githubUrl.trim()}
            >
              {#if isLoadingGithub}
                <div class="small-spinner"></div>
                Loading...
              {:else}
                Fetch
              {/if}
            </button>
          </div>
          <p class="github-help">
            Examples: <code>facebook/react</code>, <code>https://github.com/microsoft/vscode</code>
          </p>
        </div>

        {#if githubFiles.length > 0}
          <div class="github-files">
            <h4>Select a file to analyze:</h4>
            <div class="file-grid">
              {#each githubFiles as file}
                <button
                  class="github-file-btn"
                  on:click={() => selectGitHubFile(file)}
                  disabled={isProcessing}
                >
                  <div class="file-icon">
                    {#if file.path.endsWith('.js') || file.path.endsWith('.jsx')}
                      
                    {:else if file.path.endsWith('.ts') || file.path.endsWith('.tsx')}
                      
                    {:else if file.path.endsWith('.py')}
                      
                    {:else if file.path.endsWith('.java')}
                      
                    {:else if file.path.endsWith('.go')}
                      
                    {:else if file.path.endsWith('.php')}
                      
                    {:else if file.path.endsWith('.rb')}
                      
                    {:else if file.path.endsWith('.rs')}
                      
                    {:else}
                      
                    {/if}
                  </div>
                  <div class="file-details">
                    <span class="file-name">{file.displayName}</span>
                    <span class="file-path">{file.path}</span>
                  </div>
                </button>
              {/each}
            </div>
          </div>
        {/if}
      </div>
    {/if}
  {:else}
    <div class="file-preview">
      <div class="file-header">
        <div class="file-info">
          <h3>{uploadedFile?.name || 'Unknown file'}</h3>
          <p>{uploadedFile ? Math.round(uploadedFile.size / 1024) : 0}KB</p>
        </div>
  <button class="clear-btn" on:click={clearFile} aria-label="Clear file preview">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div class="file-content">
        <pre><code>{fileContent.slice(0, 500)}{fileContent.length > 500 ? '...' : ''}</code></pre>
      </div>
    </div>
  {/if}
</div>

<style>
  .upload-container {
    width: 100%;
    max-width: 700px;
    margin: 0 auto;
  }

  .tab-navigation {
    display: flex;
    margin-bottom: 1rem;
    border-bottom: 1px solid #e2e8f0;
  }

  .tab-btn {
    flex: 1;
    padding: 1rem;
    background: none;
    border: none;
    font-size: 1rem;
    font-weight: 500;
    color: #64748b;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
  }

  .tab-btn:hover {
    color: #3b82f6;
    background: #f8fafc;
  }

  .tab-btn.active {
    color: #3b82f6;
    border-bottom-color: #3b82f6;
    background: #f8fafc;
  }
  .drop-zone {
    border: 2px dashed #cbd5e1;
    border-radius: 12px;
    padding: 3rem 2rem;
    text-align: center;
    background: #f8fafc;
    transition: all 0.3s ease;
    cursor: pointer;
    min-height: 300px;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .drop-zone:hover {
    border-color: #3b82f6;
    background: #eff6ff;
  }
  .drop-zone.drag-over {
    border-color: #3b82f6;
    background: #dbeafe;
    transform: scale(1.02);
  }
  .drop-zone.processing {
    border-color: #f59e0b;
    background: #fffbeb;
  }
  .drop-content svg {
    color: #64748b;
    margin-bottom: 1rem;
  }
  .drop-content h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 0.5rem;
  }
  .drop-content p {
    color: #64748b;
    margin-bottom: 0.5rem;
  }
  .browse-link {
    color: #3b82f6;
    font-weight: 500;
    text-decoration: underline;
    cursor: pointer;
  }
  .file-types {
    font-size: 0.875rem;
    color: #94a3b8;
  }
  .processing {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1rem;
  }
  .spinner {
    width: 32px;
    height: 32px;
    border: 3px solid #f3f4f6;
    border-top: 3px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
  .file-preview {
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    overflow: hidden;
    background: white;
  }
  .file-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 1rem;
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
  }
  .file-info h3 {
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
    margin: 0;
  }
  .file-info p {
    font-size: 0.875rem;
    color: #64748b;
    margin: 0;
  }
  .clear-btn {
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    padding: 0.25rem;
    border-radius: 4px;
    transition: color 0.2s;
  }
  .clear-btn:hover {
    color: #ef4444;
  }
  .file-content {
    padding: 1rem;
    max-height: 300px;
    overflow-y: auto;
  }
  .file-content pre {
    margin: 0;
    font-family: 'Monaco', 'Menlo', monospace;
    font-size: 0.875rem;
    line-height: 1.5;
    color: #1e293b;
    white-space: pre-wrap;
  }

  /* GitHub Section Styles */
  .github-section {
    background: #f8fafc;
    border: 2px solid #e2e8f0;
    border-radius: 12px;
    padding: 2rem;
    min-height: 300px;
  }

  .github-input h3 {
    font-size: 1.25rem;
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 1rem;
    text-align: center;
  }

  .input-group {
    display: flex;
    gap: 0.5rem;
    margin-bottom: 1rem;
  }

  .github-url-input {
    flex: 1;
    padding: 0.75rem;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 1rem;
    transition: border-color 0.2s;
  }

  .github-url-input:focus {
    outline: none;
    border-color: #3b82f6;
    box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
  }

  .fetch-btn {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.75rem 1.5rem;
    background: #3b82f6;
    color: white;
    border: none;
    border-radius: 6px;
    font-weight: 500;
    cursor: pointer;
    transition: background-color 0.2s;
    white-space: nowrap;
  }

  .fetch-btn:hover:not(:disabled) {
    background: #2563eb;
  }

  .fetch-btn:disabled {
    background: #9ca3af;
    cursor: not-allowed;
  }

  .small-spinner {
    width: 16px;
    height: 16px;
    border: 2px solid transparent;
    border-top: 2px solid currentColor;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  .github-help {
    text-align: center;
    color: #64748b;
    font-size: 0.875rem;
    margin: 0;
  }

  .github-help code {
    background: #e2e8f0;
    padding: 0.125rem 0.25rem;
    border-radius: 3px;
    font-family: monospace;
  }

  .github-files {
    margin-top: 2rem;
  }

  .github-files h4 {
    font-size: 1rem;
    font-weight: 600;
    color: #1e293b;
    margin-bottom: 1rem;
  }

  .file-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    gap: 0.75rem;
    max-height: 400px;
    overflow-y: auto;
  }

  .github-file-btn {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background: white;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    text-align: left;
    cursor: pointer;
    transition: all 0.2s;
  }

  .github-file-btn:hover:not(:disabled) {
    border-color: #3b82f6;
    background: #eff6ff;
    transform: translateY(-1px);
  }

  .github-file-btn:disabled {
    background: #f3f4f6;
    cursor: not-allowed;
    opacity: 0.6;
  }

  .file-icon {
    font-size: 1.5rem;
    flex-shrink: 0;
  }

  .file-details {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }

  .file-name {
    font-weight: 500;
    color: #1e293b;
    margin-bottom: 0.25rem;
  }

  .file-path {
    font-size: 0.75rem;
    color: #64748b;
    font-family: monospace;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  @media (max-width: 640px) {
    .input-group {
      flex-direction: column;
    }

    .file-grid {
      grid-template-columns: 1fr;
    }

    .tab-btn {
      font-size: 0.875rem;
      padding: 0.75rem 0.5rem;
    }
  }
</style>
