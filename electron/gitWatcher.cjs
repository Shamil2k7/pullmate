const fs = require('fs');
const path = require('path');

/**
 * Service that observes local Git filesystem changes in real time.
 * Watches .git/HEAD and .git/refs so when the user or external tools
 * make commits, switch branches, or pull, PullMate updates immediately.
 */
class GitWatcher {
  constructor({ gitService, repositoryService, onRepositoriesChange, onPipStateChange }) {
    this.gitService = gitService;
    this.repositoryService = repositoryService;
    this.onRepositoriesChange = onRepositoriesChange || (() => {});
    this.onPipStateChange = onPipStateChange || (() => {});

    // Map of repoId -> Array of fs.FSWatcher
    this.watchers = new Map();
    // Map of repoId -> NodeJS.Timeout (for debouncing)
    this.debounceTimers = new Map();
  }

  /**
   * Synchronizes active watchers with current tracked repositories list
   */
  syncWatchers() {
    const repos = this.repositoryService.getRepositories();
    const activeRepoIds = new Set(repos.map(r => r.id));

    // Remove watchers for repositories that are no longer tracked
    for (const [repoId, watcherList] of this.watchers.entries()) {
      if (!activeRepoIds.has(repoId)) {
        for (const w of watcherList) {
          try { w.close(); } catch {}
        }
        this.watchers.delete(repoId);
        if (this.debounceTimers.has(repoId)) {
          clearTimeout(this.debounceTimers.get(repoId));
          this.debounceTimers.delete(repoId);
        }
      }
    }

    // Add watchers for newly tracked repositories
    for (const repo of repos) {
      if (!this.watchers.has(repo.id)) {
        this.watchRepository(repo);
      }
    }
  }

  /**
   * Starts watching a repository's .git internals for real-time changes
   * @param {object} repo 
   */
  watchRepository(repo) {
    if (!repo || !repo.localPath || !fs.existsSync(repo.localPath)) return;

    const gitDir = path.join(repo.localPath, '.git');
    if (!fs.existsSync(gitDir)) return;

    const watcherList = [];

    const handleGitChange = () => {
      if (this.debounceTimers.has(repo.id)) {
        clearTimeout(this.debounceTimers.get(repo.id));
      }

      const timer = setTimeout(async () => {
        try {
          const status = await this.gitService.getStatus(repo.localPath, false);
          this.repositoryService.updateRepositoryStatus(repo.id, status);
          this.onRepositoriesChange();

          // Refresh Pip character state if working tree or branch changed
          if (!status.isClean) {
            this.onPipStateChange({
              state: 'unsaved_changes',
              message: `${repo.name} has modified local files.`,
              action: { label: 'Open Folder', type: 'open_folder', repoId: repo.id }
            });
          }
        } catch (err) {
          console.warn(`[GitWatcher] Error updating ${repo.name} after local git change:`, err.message);
        }
      }, 350);

      this.debounceTimers.set(repo.id, timer);
    };

    try {
      // 1. Watch HEAD file (branch checkout, detached HEAD)
      const headFile = path.join(gitDir, 'HEAD');
      if (fs.existsSync(headFile)) {
        const headWatcher = fs.watch(headFile, (eventType) => {
          if (eventType === 'change' || eventType === 'rename') {
            handleGitChange();
          }
        });
        watcherList.push(headWatcher);
      }

      // 2. Watch FETCH_HEAD (updates from any git fetch in terminal, IDE, or background)
      const fetchHeadFile = path.join(gitDir, 'FETCH_HEAD');
      if (fs.existsSync(fetchHeadFile)) {
        const fetchWatcher = fs.watch(fetchHeadFile, () => {
          handleGitChange();
        });
        watcherList.push(fetchWatcher);
      }

      // 3. Watch refs directory (commits, branch updates, remote tracking updates)
      const refsDir = path.join(gitDir, 'refs');
      if (fs.existsSync(refsDir)) {
        const refsWatcher = fs.watch(refsDir, { recursive: true }, () => {
          handleGitChange();
        });
        watcherList.push(refsWatcher);
      }

      // 4. Watch index file (staging changes)
      const indexFile = path.join(gitDir, 'index');
      if (fs.existsSync(indexFile)) {
        const indexWatcher = fs.watch(indexFile, () => {
          handleGitChange();
        });
        watcherList.push(indexWatcher);
      }

      if (watcherList.length > 0) {
        this.watchers.set(repo.id, watcherList);
      }
    } catch (err) {
      console.warn(`[GitWatcher] Could not attach filesystem watcher to ${repo.name}:`, err.message);
    }
  }

  /**
   * Closes all active watchers
   */
  close() {
    for (const watcherList of this.watchers.values()) {
      for (const w of watcherList) {
        try { w.close(); } catch {}
      }
    }
    this.watchers.clear();

    for (const timer of this.debounceTimers.values()) {
      clearTimeout(timer);
    }
    this.debounceTimers.clear();
  }
}

module.exports = GitWatcher;
