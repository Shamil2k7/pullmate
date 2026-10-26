const fs = require('fs');
const path = require('path');
const { app } = require('electron');

class RepositoryService {
  constructor(customStorageDir = null) {
    this.storageDir = customStorageDir || (app ? app.getPath('userData') : path.join(process.cwd(), '.userData'));
    this.repositoriesFilePath = path.join(this.storageDir, 'repositories.json');
    this.cachedRepos = null;
  }

  _ensureDir() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /**
   * Retrieves all tracked repositories
   * @returns {Array<object>}
   */
  getRepositories() {
    if (this.cachedRepos) {
      return [...this.cachedRepos];
    }

    this._ensureDir();

    if (!fs.existsSync(this.repositoriesFilePath)) {
      this.cachedRepos = [];
      this._saveToDisk(this.cachedRepos);
      return [];
    }

    try {
      const data = fs.readFileSync(this.repositoriesFilePath, 'utf-8');
      const parsed = JSON.parse(data);
      this.cachedRepos = Array.isArray(parsed) ? parsed : [];
      return [...this.cachedRepos];
    } catch (err) {
      console.error('[RepositoryService] Error reading repositories.json, resetting cache:', err.message);
      this.cachedRepos = [];
      return [];
    }
  }

  /**
   * Adds a new repository to tracking
   * @param {object} repoData
   * @returns {object} created repository
   */
  addRepository(repoData) {
    const repos = this.getRepositories();

    // Normalize path
    const normalizedPath = path.normalize(repoData.localPath);

    // Prevent duplicate paths
    const existingIndex = repos.findIndex(r => path.normalize(r.localPath).toLowerCase() === normalizedPath.toLowerCase());
    if (existingIndex >= 0) {
      throw new Error(`Repository at "${normalizedPath}" is already being tracked by PullMate.`);
    }

    const newRepo = {
      id: `repo_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      githubId: repoData.githubId || null,
      name: repoData.name || path.basename(normalizedPath),
      fullName: repoData.fullName || repoData.name || path.basename(normalizedPath),
      owner: repoData.owner || '',
      isPrivate: Boolean(repoData.isPrivate),
      defaultBranch: repoData.defaultBranch || 'main',
      localPath: normalizedPath,
      linkedAt: new Date().toISOString(),
      lastCheckedAt: null,
      lastSuccessfulFetchAt: null,
      status: 'checking',
      behindCount: 0,
      aheadCount: 0,
      currentBranch: '',
      trackingBranch: '',
      isClean: true,
      lastError: null,
      suppressNotificationUntil: null
    };

    repos.push(newRepo);
    this.cachedRepos = repos;
    this._saveToDisk(repos);
    return newRepo;
  }

  /**
   * Removes a repository from tracking without deleting user's local files
   * @param {string} repoId 
   * @returns {boolean}
   */
  removeRepository(repoId) {
    const repos = this.getRepositories();
    const filtered = repos.filter(r => r.id !== repoId);
    if (filtered.length !== repos.length) {
      this.cachedRepos = filtered;
      this._saveToDisk(filtered);
      return true;
    }
    return false;
  }

  /**
   * Updates partial data for a repository
   * @param {string} repoId 
   * @param {object} updates 
   * @returns {object|null}
   */
  updateRepository(repoId, updates) {
    const repos = this.getRepositories();
    const index = repos.findIndex(r => r.id === repoId);
    if (index === -1) {
      return null;
    }

    const updated = {
      ...repos[index],
      ...updates
    };

    repos[index] = updated;
    this.cachedRepos = repos;
    this._saveToDisk(repos);
    return updated;
  }

  /**
   * Updates Git status metrics for a repository
   * @param {string} repoId 
   * @param {object} statusData 
   * @returns {object|null}
   */
  updateRepositoryStatus(repoId, statusData) {
    return this.updateRepository(repoId, {
      status: statusData.status,
      behindCount: typeof statusData.behindCount === 'number' ? statusData.behindCount : 0,
      aheadCount: typeof statusData.aheadCount === 'number' ? statusData.aheadCount : 0,
      currentBranch: statusData.currentBranch || '',
      trackingBranch: statusData.trackingBranch || '',
      isClean: statusData.isClean !== undefined ? statusData.isClean : true,
      lastCheckedAt: new Date().toISOString(),
      lastSuccessfulFetchAt: statusData.fetchSuccess ? new Date().toISOString() : statusData.lastSuccessfulFetchAt,
      lastError: statusData.lastError || null
    });
  }

  _saveToDisk(repos) {
    this._ensureDir();
    try {
      fs.writeFileSync(this.repositoriesFilePath, JSON.stringify(repos, null, 2), 'utf-8');
    } catch (err) {
      console.error('[RepositoryService] Failed to write repositories to disk:', err.message);
    }
  }
}

module.exports = RepositoryService;
