const { execFile, spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

class GitService {
  constructor() {
    // Map of active path -> Promise, to prevent overlapping Git operations on the same repo
    this.locks = new Map();
  }

  /**
   * Helper to execute git command safely with argument arrays and timeout
   * @param {string[]} args 
   * @param {string} cwd 
   * @param {number} timeoutMs 
   * @returns {Promise<{stdout: string, stderr: string}>}
   */
  async _runGit(args, cwd = process.cwd(), timeoutMs = 25000) {
    return new Promise((resolve, reject) => {
      execFile('git', args, {
        cwd,
        timeout: timeoutMs,
        maxBuffer: 10 * 1024 * 1024,
        env: {
          ...process.env,
          // Avoid interactive credential prompts freezing the process
          GIT_TERMINAL_PROMPT: '0',
          GIT_ASKPASS: ''
        }
      }, (error, stdout, stderr) => {
        if (error) {
          error.stdout = stdout ? stdout.toString() : '';
          error.stderr = stderr ? stderr.toString() : '';
          return reject(error);
        }
        resolve({
          stdout: stdout ? stdout.toString().trim() : '',
          stderr: stderr ? stderr.toString().trim() : ''
        });
      });
    });
  }

  /**
   * Run operation with exclusive lock per repo path
   * @param {string} repoPath 
   * @param {Function} task 
   */
  async withLock(repoPath, task) {
    const key = path.normalize(repoPath).toLowerCase();
    while (this.locks.has(key)) {
      try {
        await this.locks.get(key);
      } catch {
        // Wait for previous task to finish even if it threw
      }
    }

    let promiseResolve;
    const lockPromise = new Promise(res => { promiseResolve = res; });
    this.locks.set(key, lockPromise);

    try {
      return await task();
    } finally {
      this.locks.delete(key);
      promiseResolve();
    }
  }

  /**
   * Checks if git is installed on the host system
   * @returns {Promise<{installed: boolean, version: string|null}>}
   */
  async checkGitInstalled() {
    try {
      const { stdout } = await this._runGit(['--version']);
      return {
        installed: true,
        version: stdout
      };
    } catch (err) {
      return {
        installed: false,
        version: null,
        error: err.message
      };
    }
  }

  /**
   * Validates if a directory exists and is a git repository
   * @param {string} folderPath 
   * @returns {Promise<{isValid: boolean, isRepo: boolean, rootPath: string|null, remoteUrl: string|null, remoteIdentity: object|null, error: string|null}>}
   */
  async validateLocalFolder(folderPath) {
    if (!folderPath || typeof folderPath !== 'string') {
      return { isValid: false, isRepo: false, rootPath: null, remoteUrl: null, remoteIdentity: null, error: 'Path is required' };
    }

    // Strip wrapping quotes (e.g. from Windows "Copy as path")
    const clean = folderPath.replace(/^["']|["']$/g, '').trim();
    const normalized = path.normalize(clean);

    if (!fs.existsSync(normalized)) {
      return { isValid: false, isRepo: false, rootPath: null, remoteUrl: null, remoteIdentity: null, error: 'Folder does not exist on disk' };
    }

    try {
      const stat = fs.statSync(normalized);
      if (!stat.isDirectory()) {
        return { isValid: false, isRepo: false, rootPath: null, remoteUrl: null, remoteIdentity: null, error: 'Path is not a directory' };
      }

      const { stdout: isInside } = await this._runGit(['rev-parse', '--is-inside-work-tree'], normalized);
      if (isInside !== 'true') {
        return { isValid: true, isRepo: false, rootPath: null, remoteUrl: null, remoteIdentity: null, error: 'Not a Git repository (.git not found)' };
      }

      const { stdout: topLevel } = await this._runGit(['rev-parse', '--show-toplevel'], normalized);
      const rootPath = path.normalize(topLevel);
      const remoteUrl = await this.getRemoteUrl(rootPath, 'origin');
      const remoteIdentity = this.parseRemoteUrl(remoteUrl);

      return {
        isValid: true,
        isRepo: true,
        rootPath,
        remoteUrl,
        remoteIdentity,
        error: null
      };
    } catch (err) {
      return {
        isValid: true,
        isRepo: false,
        rootPath: null,
        remoteUrl: null,
        remoteIdentity: null,
        error: 'Not a Git repository or corrupted repository'
      };
    }
  }

  /**
   * Extracts remote URL (defaults to 'origin')
   * @param {string} repoPath 
   * @param {string} remoteName 
   * @returns {Promise<string|null>}
   */
  async getRemoteUrl(repoPath, remoteName = 'origin') {
    try {
      const { stdout } = await this._runGit(['config', '--get', `remote.${remoteName}.url`], repoPath);
      return stdout || null;
    } catch {
      return null;
    }
  }

  /**
   * Parses git remote URL into repository identity { owner, name, fullName }
   * @param {string} remoteUrl 
   * @returns {{ owner: string, name: string, fullName: string }|null}
   */
  parseRemoteUrl(remoteUrl) {
    if (!remoteUrl || typeof remoteUrl !== 'string') return null;

    let clean = remoteUrl.trim();
    // Remove trailing .git
    if (clean.endsWith('.git')) {
      clean = clean.slice(0, -4);
    }

    // Match HTTPS: https://github.com/owner/repo
    // Match SSH: git@github.com:owner/repo
    // Match SSH with protocol: ssh://git@github.com/owner/repo
    const httpsMatch = clean.match(/https?:\/\/[^/]+\/([^/]+)\/([^/]+)/);
    if (httpsMatch) {
      return {
        owner: httpsMatch[1],
        name: httpsMatch[2],
        fullName: `${httpsMatch[1]}/${httpsMatch[2]}`.toLowerCase()
      };
    }

    const sshMatch = clean.match(/git@[^:]+:([^/]+)\/([^/]+)/);
    if (sshMatch) {
      return {
        owner: sshMatch[1],
        name: sshMatch[2],
        fullName: `${sshMatch[1]}/${sshMatch[2]}`.toLowerCase()
      };
    }

    return null;
  }

  /**
   * Inspects working tree cleanliness
   * @param {string} repoPath 
   * @returns {Promise<{isClean: boolean, changedCount: number, statusSummary: string}>}
   */
  async checkWorkingTree(repoPath) {
    try {
      const { stdout } = await this._runGit(['status', '--porcelain'], repoPath);
      if (!stdout) {
        return { isClean: true, changedCount: 0, statusSummary: 'Clean working tree' };
      }
      const lines = stdout.split('\n').filter(Boolean);
      return {
        isClean: false,
        changedCount: lines.length,
        statusSummary: `${lines.length} uncommitted file${lines.length > 1 ? 's' : ''}`
      };
    } catch (err) {
      return { isClean: false, changedCount: 0, statusSummary: `Error inspecting status: ${err.message}` };
    }
  }

  /**
   * Fetches remote updates safely (does not merge)
   * @param {string} repoPath 
   * @returns {Promise<{success: boolean, error: string|null}>}
   */
  async fetchRemote(repoPath) {
    return this.withLock(repoPath, async () => {
      try {
        await this._runGit(['fetch', '--prune'], repoPath, 35000);
        return { success: true, error: null };
      } catch (err) {
        let msg = err.stderr || err.message;
        if (msg.includes('Could not resolve host') || msg.includes('Failed to connect')) {
          msg = 'Network connection failed. Unable to reach remote server.';
        } else if (msg.includes('Authentication failed') || msg.includes('Permission denied')) {
          msg = 'Authentication failed. Please check Git credentials.';
        }
        return { success: false, error: msg };
      }
    });
  }

  /**
   * Computes full status of a repository
   * @param {string} repoPath 
   * @param {boolean} shouldFetchFirst 
   * @returns {Promise<object>}
   */
  async getStatus(repoPath, shouldFetchFirst = false) {
    return this.withLock(repoPath, async () => {
      const validation = await this.validateLocalFolder(repoPath);
      if (!validation.isValid || !validation.isRepo) {
        return {
          status: 'repo_unavailable',
          isClean: false,
          currentBranch: '',
          trackingBranch: '',
          aheadCount: 0,
          behindCount: 0,
          lastError: validation.error || 'Repository folder unavailable'
        };
      }

      let fetchSuccess = false;
      let fetchError = null;

      if (shouldFetchFirst) {
        try {
          await this._runGit(['fetch', '--prune'], repoPath, 30000);
          fetchSuccess = true;
        } catch (err) {
          fetchError = err.stderr || err.message;
          if (fetchError.includes('Could not resolve host') || fetchError.includes('Failed to connect')) {
            fetchError = 'Unable to reach remote. Working offline.';
          }
        }
      }

      // Check current branch
      let currentBranch = '';
      try {
        const { stdout: branch } = await this._runGit(['branch', '--show-current'], repoPath);
        currentBranch = branch;
      } catch {
        // Fallback for detached HEAD or older git
        try {
          const { stdout: headRef } = await this._runGit(['rev-parse', '--abbrev-ref', 'HEAD'], repoPath);
          currentBranch = headRef;
        } catch {
          currentBranch = 'HEAD';
        }
      }

      // Check working tree cleanliness
      const tree = await this.checkWorkingTree(repoPath);

      // Check configured upstream branch
      let trackingBranch = '';
      let hasUpstream = false;
      try {
        const { stdout: upstream } = await this._runGit(['rev-parse', '--abbrev-ref', '@{upstream}'], repoPath);
        trackingBranch = upstream;
        hasUpstream = Boolean(upstream);
      } catch {
        hasUpstream = false;
      }

      if (!hasUpstream) {
        return {
          status: tree.isClean ? 'no_upstream' : 'uncommitted_changes',
          isClean: tree.isClean,
          currentBranch,
          trackingBranch: '',
          aheadCount: 0,
          behindCount: 0,
          fetchSuccess,
          lastError: fetchError || (tree.isClean ? 'No upstream branch configured for this branch' : tree.statusSummary)
        };
      }

      // Compare local HEAD with remote tracking branch
      let aheadCount = 0;
      let behindCount = 0;
      try {
        const { stdout: counts } = await this._runGit(['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'], repoPath);
        // stdout format: "<ahead>\t<behind>"
        const parts = counts.split(/\s+/);
        aheadCount = parseInt(parts[0], 10) || 0;
        behindCount = parseInt(parts[1], 10) || 0;
      } catch (err) {
        return {
          status: fetchError ? 'fetch_failed' : 'error',
          isClean: tree.isClean,
          currentBranch,
          trackingBranch,
          aheadCount: 0,
          behindCount: 0,
          fetchSuccess,
          lastError: fetchError || err.message
        };
      }

      // Determine synthesized status
      let status = 'up_to_date';
      if (!tree.isClean && behindCount > 0) {
        status = 'behind'; // Behind takes high priority so user knows they need to sync, but we also flag uncommitted changes
      } else if (!tree.isClean) {
        status = 'uncommitted_changes';
      } else if (aheadCount > 0 && behindCount > 0) {
        status = 'diverged';
      } else if (behindCount > 0) {
        status = 'behind';
      } else if (aheadCount > 0) {
        status = 'ahead';
      } else {
        status = 'up_to_date';
      }

      if (fetchError && status === 'up_to_date') {
        // Do not assume up to date when fetch fails
        status = 'fetch_failed';
      }

      return {
        status,
        isClean: tree.isClean,
        currentBranch,
        trackingBranch,
        aheadCount,
        behindCount,
        fetchSuccess,
        lastError: fetchError || (!tree.isClean ? tree.statusSummary : null)
      };
    });
  }

  /**
   * Safely pulls changes with fast-forward only
   * Checks uncommitted changes and divergence first
   * @param {string} repoPath 
   * @returns {Promise<{success: boolean, message: string, status: object}>}
   */
  async safePull(repoPath) {
    return this.withLock(repoPath, async () => {
      // 1. Verify working tree
      const tree = await this.checkWorkingTree(repoPath);
      if (!tree.isClean) {
        throw new Error(`Cannot pull: You have uncommitted changes (${tree.statusSummary}). Please commit or stash your changes first.`);
      }

      // 2. Refresh remote
      try {
        await this._runGit(['fetch', '--prune'], repoPath, 35000);
      } catch (err) {
        throw new Error(`Cannot pull: Remote fetch failed: ${err.stderr || err.message}`);
      }

      // 3. Check divergence
      try {
        const { stdout: counts } = await this._runGit(['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'], repoPath);
        const parts = counts.split(/\s+/);
        const ahead = parseInt(parts[0], 10) || 0;
        const behind = parseInt(parts[1], 10) || 0;

        if (ahead > 0 && behind > 0) {
          throw new Error(`Cannot fast-forward: Local and remote branches have diverged (${ahead} ahead, ${behind} behind). Manual resolution required.`);
        }

        if (behind === 0) {
          return {
            success: true,
            message: 'Already up to date.',
            status: await this.getStatus(repoPath, false)
          };
        }
      } catch (err) {
        throw new Error(`Cannot verify upstream state: ${err.message}`);
      }

      // 4. Run fast-forward only pull
      try {
        const { stdout } = await this._runGit(['pull', '--ff-only'], repoPath, 45000);
        const newStatus = await this.getStatus(repoPath, false);
        return {
          success: true,
          message: stdout || 'Successfully pulled changes (fast-forward).',
          status: newStatus
        };
      } catch (err) {
        throw new Error(`Git pull failed: ${err.stderr || err.message}`);
      }
    });
  }

  /**
   * Clones a repository into target directory
   * @param {string} cloneUrl 
   * @param {string} parentDir 
   * @param {string} folderName 
   * @param {Function} onProgress 
   * @returns {Promise<{success: boolean, destinationPath: string}>}
   */
  async cloneRepository(cloneUrl, parentDir, folderName, onProgress = null) {
    if (!cloneUrl || !parentDir || !folderName) {
      throw new Error('cloneUrl, parentDir, and folderName are required');
    }

    const destinationPath = path.join(parentDir, folderName);
    if (fs.existsSync(destinationPath)) {
      throw new Error(`Destination directory already exists: ${destinationPath}`);
    }

    return new Promise((resolve, reject) => {
      const child = spawn('git', ['clone', '--progress', cloneUrl, destinationPath], {
        env: {
          ...process.env,
          GIT_TERMINAL_PROMPT: '0',
          GIT_ASKPASS: ''
        }
      });

      let stderrAccum = '';

      child.stderr.on('data', data => {
        const str = data.toString();
        stderrAccum += str;
        if (onProgress) {
          // Parse progress percentage if available, e.g. "Receiving objects:  45% (123/273)"
          onProgress(str);
        }
      });

      child.on('error', err => {
        reject(new Error(`Failed to start git clone: ${err.message}`));
      });

      child.on('close', code => {
        if (code === 0) {
          resolve({
            success: true,
            destinationPath: path.normalize(destinationPath)
          });
        } else {
          let cleanErr = stderrAccum;
          if (cleanErr.includes('Authentication failed') || cleanErr.includes('Permission denied')) {
            cleanErr = 'Authentication failed. Please verify your Git credentials for GitHub.';
          } else if (cleanErr.includes('Repository not found')) {
            cleanErr = 'Repository not found or access denied.';
          }
          reject(new Error(cleanErr || `Git clone exited with code ${code}`));
        }
      });
    });
  }
}

module.exports = GitService;
