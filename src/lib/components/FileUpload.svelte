<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{ fileUploaded: { file: File; content: string } }>();

  let isDragOver = false;
  let isProcessing = false;
  let uploadedFile: File | null = null;
  let fileContent = '';
  let fileInput: HTMLInputElement;

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
  }
</script>

<div class="upload-container">
  {#if !uploadedFile}
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
  {:else}
    <div class="file-preview">
      <div class="file-header">
        <div class="file-info">
          <h3>{uploadedFile.name}</h3>
          <p>{Math.round(uploadedFile.size / 1024)}KB</p>
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
    max-width: 600px;
    margin: 0 auto;
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
</style>
