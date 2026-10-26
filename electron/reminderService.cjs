const { Notification } = require('electron');

class ReminderService {
  constructor({ gitService, repositoryService, settingsService, onPipStateChange, onRepositoriesChange, onShowMainWindow }) {
    this.gitService = gitService;
    this.repositoryService = repositoryService;
    this.settingsService = settingsService;
    this.onPipStateChange = onPipStateChange || (() => {});
    this.onRepositoriesChange = onRepositoriesChange || (() => {});
    this.onShowMainWindow = onShowMainWindow || (() => {});

    this.timer = null;
    this.isChecking = false;
    // Map of repoId -> { count: number, timestamp: number }
    this.notificationHistory = new Map();
  }

  /**
   * Starts the background scheduler
   */
  start() {
    this.stop();
    const settings = this.settingsService.getSettings();
    const intervalMinutes = Math.max(1, settings.checkIntervalMinutes !== undefined ? settings.checkIntervalMinutes : 1);
    const intervalMs = intervalMinutes * 60 * 1000;

    console.log(`[ReminderService] Scheduler started. Checking every ${intervalMinutes} minute(s) (${intervalMs}ms).`);

    this.timer = setInterval(() => {
      this.checkAll({ isBackgroundScheduled: true });
    }, intervalMs);

    // Initial background check shortly after startup
    setTimeout(() => {
      this.checkAll({ isInitialCheck: true });
    }, 1500);
  }

  /**
   * Restarts the timer with latest settings
   */
  restart() {
    this.start();
  }

  /**
   * Stops the background scheduler
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Determines if quiet hours are currently active
   * @param {object} settings 
   * @returns {boolean}
   */
  isQuietHours(settings) {
    if (!settings.quietHoursEnabled) return false;

    try {
      const now = new Date();
      const currentMinutes = now.getHours() * 60 + now.getMinutes();

      const [startH, startM] = settings.quietHoursStart.split(':').map(Number);
      const [endH, endM] = settings.quietHoursEnd.split(':').map(Number);

      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      if (startMinutes < endMinutes) {
        return currentMinutes >= startMinutes && currentMinutes < endMinutes;
      } else {
        // Spans midnight, e.g. 22:00 to 08:00
        return currentMinutes >= startMinutes || currentMinutes < endMinutes;
      }
    } catch {
      return false;
    }
  }

  /**
   * Determines if notifications are currently snoozed
   * @param {object} settings 
   * @returns {boolean}
   */
  isSnoozed(settings) {
    if (!settings.snoozeUntil) return false;
    const snoozeTime = Date.parse(settings.snoozeUntil);
    if (isNaN(snoozeTime)) return false;
    return Date.now() < snoozeTime;
  }

  /**
   * Checks status of all tracked repositories
   * @param {object} options 
   */
  async checkAll(options = {}) {
    if (this.isChecking) {
      return { skipped: true, reason: 'Check already in progress' };
    }

    this.isChecking = true;
    const settings = this.settingsService.getSettings();
    const repos = this.repositoryService.getRepositories();

    if (repos.length === 0) {
      this.isChecking = false;
      return { checkedCount: 0 };
    }

    // Set Pip to checking state
    this.onPipStateChange({
      state: 'checking',
      message: 'Checking for Git updates...',
      action: null
    });

    let totalBehind = 0;
    let behindRepos = [];
    let uncommittedRepos = [];
    let errorRepos = [];

    // Limit concurrency to 3 simultaneous checks
    const concurrency = 3;
    const queue = [...repos];

    const worker = async () => {
      while (queue.length > 0) {
        const repo = queue.shift();
        try {
          const status = await this.gitService.getStatus(repo.localPath, true);
          this.repositoryService.updateRepositoryStatus(repo.id, status);

          if (status.status === 'behind') {
            totalBehind += status.behindCount;
            behindRepos.push({ repo, status });
          } else if (status.status === 'uncommitted_changes' || !status.isClean) {
            uncommittedRepos.push({ repo, status });
          } else if (status.status === 'fetch_failed' || status.status === 'repo_unavailable') {
            errorRepos.push({ repo, status });
          }
        } catch (err) {
          console.error(`[ReminderService] Error checking ${repo.name}:`, err.message);
          this.repositoryService.updateRepositoryStatus(repo.id, {
            status: 'fetch_failed',
            lastError: err.message
          });
          errorRepos.push({ repo, status: { lastError: err.message } });
        }
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, repos.length) }, () => worker());
    await Promise.all(workers);

    // Save global last checked timestamp
    this.settingsService.updateSettings({ lastGlobalCheckAt: new Date().toISOString() });
    this.onRepositoriesChange();

    this.isChecking = false;

    // Evaluate notifications & Pip character state
    this._evaluateStateAndNotifications({
      settings,
      behindRepos,
      uncommittedRepos,
      errorRepos,
      totalRepos: repos.length,
      options
    });

    return {
      checkedCount: repos.length,
      behindCount: behindRepos.length,
      errorCount: errorRepos.length
    };
  }

  /**
   * Checks a single repository by ID
   * @param {string} repoId 
   * @returns {Promise<object>}
   */
  async checkRepository(repoId) {
    const repos = this.repositoryService.getRepositories();
    const repo = repos.find(r => r.id === repoId);
    if (!repo) {
      throw new Error(`Repository not found: ${repoId}`);
    }

    this.onPipStateChange({
      state: 'checking',
      message: `Checking ${repo.name}...`,
      action: null
    });

    const status = await this.gitService.getStatus(repo.localPath, true);
    const updated = this.repositoryService.updateRepositoryStatus(repo.id, status);
    this.onRepositoriesChange();

    if (status.status === 'behind') {
      this.onPipStateChange({
        state: 'updates_available',
        message: `${repo.name} is ${status.behindCount} commit${status.behindCount > 1 ? 's' : ''} behind.`,
        action: { label: 'Pull Changes', type: 'pull', repoId: repo.id }
      });
    } else if (status.status === 'up_to_date') {
      this.onPipStateChange({
        state: 'up_to_date',
        message: `${repo.name} is synchronized!`,
        action: null
      });
    } else if (!status.isClean) {
      this.onPipStateChange({
        state: 'unsaved_changes',
        message: `${repo.name} has uncommitted work.`,
        action: { label: 'Review', type: 'open_folder', repoId: repo.id }
      });
    }

    return updated;
  }

  /**
   * Evaluates Pip state and sends notifications
   */
  _evaluateStateAndNotifications({ settings, behindRepos, uncommittedRepos, errorRepos, totalRepos, options }) {
    const quiet = this.isQuietHours(settings);
    const snoozed = this.isSnoozed(settings);

    if (quiet) {
      this.onPipStateChange({
        state: 'sleeping',
        message: 'Quiet hours active. Sleeping soundly... zZz',
        action: null
      });
      return;
    }

    // Determine Pip character reaction
    if (behindRepos.length > 0) {
      const first = behindRepos[0];
      const message = behindRepos.length === 1
        ? `${first.repo.name} is ${first.status.behindCount} commit${first.status.behindCount > 1 ? 's' : ''} behind. Review updates?`
        : `${behindRepos.length} repositories have updates available!`;

      this.onPipStateChange({
        state: 'updates_available',
        message,
        action: { label: 'Open PullMate', type: 'open_dashboard' }
      });
    } else if (uncommittedRepos.length > 0) {
      const first = uncommittedRepos[0];
      this.onPipStateChange({
        state: 'unsaved_changes',
        message: `You have uncommitted changes in ${first.repo.name}.`,
        action: { label: 'Open Folder', type: 'open_folder', repoId: first.repo.id }
      });
    } else if (errorRepos.length > 0 && errorRepos.length === totalRepos) {
      this.onPipStateChange({
        state: 'error',
        message: "Couldn't reach remote repository. Working offline.",
        action: null
      });
    } else {
      this.onPipStateChange({
        state: 'up_to_date',
        message: 'All your repositories are up to date! Great job!',
        action: null
      });
    }

    // Windows Native Notification dispatch
    if (!settings.notificationsEnabled || quiet || snoozed) {
      return;
    }

    for (const item of behindRepos) {
      const { repo, status } = item;
      const history = this.notificationHistory.get(repo.id);
      const now = Date.now();

      // Trigger notification if:
      // 1. Repo is newly behind
      // 2. OR incoming commit count has changed (someone pushed another commit)
      // 3. OR 10 minutes have elapsed since the last alert
      const shouldNotify = !history ||
        (status.behindCount !== history.count) ||
        ((now - history.timestamp) > 10 * 60 * 1000);

      if (!shouldNotify) {
        continue;
      }

      this.notificationHistory.set(repo.id, {
        count: status.behindCount,
        timestamp: now
      });

      this._sendNativeNotification(
        `PullMate: ${repo.name} Needs Sync (${status.behindCount} new commit${status.behindCount > 1 ? 's' : ''})`,
        `Branch is ${status.behindCount} commit${status.behindCount > 1 ? 's' : ''} behind remote (${status.trackingBranch || 'origin'}). Fast-forward pull available.`
      );
    }

    // Reset notification history for repositories that are now up to date
    // so any new remote commits trigger an immediate notification
    const currentRepos = this.repositoryService.getRepositories();
    for (const repo of currentRepos) {
      if (!behindRepos.some(b => b.repo.id === repo.id)) {
        this.notificationHistory.delete(repo.id);
      }
    }
  }

  _sendNativeNotification(title, body) {
    try {
      if (Notification.isSupported()) {
        const notification = new Notification({
          title,
          body,
          silent: false,
          urgency: 'critical',
          timeoutType: 'default'
        });

        notification.on('click', () => {
          this.onShowMainWindow();
        });

        notification.show();
        console.log(`[ReminderService] Native toast notification shown: "${title}"`);
      } else {
        console.warn('[ReminderService] Native Notification API is not supported on this host.');
      }
    } catch (err) {
      console.warn('[ReminderService] Native notification failed:', err.message);
    }
  }

  /**
   * Sets snooze duration in hours
   * @param {number} hours 
   */
  snooze(hours = 2) {
    const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
    this.settingsService.updateSettings({ snoozeUntil: until });
    this.onPipStateChange({
      state: 'sleeping',
      message: `Reminders snoozed for ${hours} hour${hours > 1 ? 's' : ''}.`,
      action: null
    });
  }

  /**
   * Clears active snooze
   */
  clearSnooze() {
    this.settingsService.updateSettings({ snoozeUntil: null });
  }
}

module.exports = ReminderService;
