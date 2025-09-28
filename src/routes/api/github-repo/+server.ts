// src/routes/api/github-repo/+server.ts
// API endpoint for fetching GitHub repository information

import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import type { RequestHandler } from './$types';

interface GitHubFile {
  path: string;
  size: number;
  download_url: string;
  type: string;
}

interface RepoInfo {
  owner: string;
  repo: string;
  branch: string;
}

function parseGitHubUrl(url: string): RepoInfo | null {
  const patterns = [
    /^https?:\/\/github\.com\/([^\/]+)\/([^\/]+)(?:\/tree\/([^\/]+))?/,
    /^github\.com\/([^\/]+)\/([^\/]+)(?:\/tree\/([^\/]+))?/,
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

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { githubUrl } = await request.json();
    
    if (!githubUrl) {
      return json({ 
        success: false, 
        error: 'GitHub URL is required' 
      }, { status: 400 });
    }

    const parsed = parseGitHubUrl(githubUrl);
    if (!parsed) {
      return json({
        success: false,
        error: 'Invalid GitHub URL format'
      }, { status: 400 });
    }

    // Try main branch first, then master if main fails
    const branches = [parsed.branch, 'main', 'master'];
    let repoData = null;
    let workingBranch = null;

    for (const branch of branches) {
      try {
        const treeUrl = `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/git/trees/${branch}?recursive=1`;
        const response = await fetch(treeUrl, {
          headers: {
            'User-Agent': 'AuditFix-Security-Tool',
            // Add GitHub token if available for higher rate limits
            ...(env.GITHUB_TOKEN && { 
              'Authorization': `token ${env.GITHUB_TOKEN}` 
            })
          }
        });
        
        if (response.ok) {
          repoData = await response.json();
          workingBranch = branch;
          break;
        }
      } catch (err) {
        continue; // Try next branch
      }
    }

    if (!repoData) {
      return json({
        success: false,
        error: 'Repository not found or not accessible. Make sure it\'s public.'
      }, { status: 404 });
    }

    // Filter for code files
    const codeExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.java', '.php', '.rb', '.cs', '.cpp', '.c', '.rs', '.kt', '.json', '.yml', '.yaml', '.env'];
    const maxFileSize = 1000000; // 1MB limit
    
    const codeFiles = repoData.tree
      .filter((item: any) => 
        item.type === 'blob' && 
        codeExtensions.some(ext => item.path.toLowerCase().endsWith(ext)) &&
        item.size < maxFileSize &&
        // Skip common non-source directories
        !item.path.match(/^(node_modules|\.git|dist|build|target|vendor|\.next)\//)
      )
      .map((file: any) => ({
        path: file.path,
        size: file.size,
        sha: file.sha,
        displayName: file.path.split('/').pop(),
        directory: file.path.includes('/') ? file.path.substring(0, file.path.lastIndexOf('/')) : '',
        extension: file.path.split('.').pop()?.toLowerCase(),
        owner: parsed.owner,
        repo: parsed.repo,
        branch: workingBranch
      }))
      .sort((a: any, b: any) => {
        // Sort by directory first, then by file name
        if (a.directory !== b.directory) {
          return a.directory.localeCompare(b.directory);
        }
        return a.displayName.localeCompare(b.displayName);
      });

    return json({
      success: true,
      data: {
        repository: {
          owner: parsed.owner,
          repo: parsed.repo,
          branch: workingBranch,
          url: `https://github.com/${parsed.owner}/${parsed.repo}`
        },
        files: codeFiles,
        totalFiles: codeFiles.length
      }
    });

  } catch (err) {
    console.error('GitHub repo fetch error:', err);
    
    return json({
      success: false,
      error: err instanceof Error ? err.message : 'Failed to fetch repository'
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