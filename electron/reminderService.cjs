const { Notification, nativeImage } = require('electron');

class ReminderService {
  constructor({ gitService, repositoryService, settingsService, onPipStateChange, onRepositoriesChange, onSettingsChange, onShowMainWindow, onNotification }) {
    this.gitService = gitService;
    this.repositoryService = repositoryService;
    this.settingsService = settingsService;
    this.onPipStateChange = onPipStateChange || (() => {});
    this.onRepositoriesChange = onRepositoriesChange || (() => {});
    this.onSettingsChange = onSettingsChange || (() => {});
    this.onShowMainWindow = onShowMainWindow || (() => {});
    this.onNotification = onNotification || (() => {});

    this.timer = null;
    this.isChecking = false;
    // Map of repoId -> { count: number, timestamp: number }
    this.notificationHistory = new Map();

    // Cache native icon for Windows toasts
    this.appIcon = this._createAppIcon();
  }

  /**
   * Generates a crisp icon image for native Windows notifications
   */
  _createAppIcon() {
    try {
      if (nativeImage) {
        const svg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="11" fill="#2E7D32"/>
            <circle cx="8" cy="10" r="2.2" fill="#FFFFFF"/>
            <circle cx="16" cy="10" r="2.2" fill="#FFFFFF"/>
            <path d="M7 15 C9 18, 15 18, 17 15" stroke="#FFFFFF" stroke-width="2.2" stroke-linecap="round"/>
          </svg>
        `.trim();
        return nativeImage.createFromDataURL(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
      }
    } catch {
      // Fallback if nativeImage fails
    }
    return null;
  }

  /**
   * Starts the background scheduler
   */
  start() {
    this.stop();
    const settings = this.settingsService.getSettings();
    const intervalMinutes = typeof settings.checkIntervalMinutes === 'number' && settings.checkIntervalMinutes > 0
      ? settings.checkIntervalMinutes
      : 0.5;
    // Minimum 10 seconds, default based on settings (e.g. 0.5 = 30 seconds, 0.25 = 15 seconds)
    const intervalMs = Math.max(10000, Math.round(intervalMinutes * 60 * 1000));

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
    try {
      const settings = this.settingsService.getSettings();
      const repos = this.repositoryService.getRepositories();

      if (repos.length === 0) {
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

      // Save global last checked timestamp and notify both repos and settings to update UI in real time
      const updatedSettings = this.settingsService.updateSettings({ lastGlobalCheckAt: new Date().toISOString() });
      this.onRepositoriesChange();
      this.onSettingsChange(updatedSettings);

      // Evaluate notifications & Pip character state
      this._evaluateStateAndNotifications({
        settings: updatedSettings,
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
    } finally {
      this.isChecking = false;
    }
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

    const settings = this.settingsService.getSettings();

    if (status.status === 'behind') {
      this.onPipStateChange({
        state: 'updates_available',
        message: `${repo.name} is ${status.behindCount} commit${status.behindCount > 1 ? 's' : ''} behind.`,
        action: { label: 'Pull Changes', type: 'pull', repoId: repo.id }
      });

      // Send real-time notification immediately on manual check
      if (settings.notificationsEnabled && !this.isQuietHours(settings) && !this.isSnoozed(settings)) {
        this._sendNativeNotification(
          `PullMate: ${repo.name} Needs Sync (${status.behindCount} new commit${status.behindCount > 1 ? 's' : ''})`,
          `Branch is ${status.behindCount} commit${status.behindCount > 1 ? 's' : ''} behind remote. Fast-forward pull ready.`,
          { type: 'warning', repoId: repo.id }
        );
      }
    } else if (status.status === 'up_to_date') {
      this.onPipStateChange({
        state: 'up_to_date',
        message: `${repo.name} is synchronized!`,
        action: null
      });

      // In-app real-time feedback
      this.onNotification({
        id: Date.now(),
        type: 'success',
        title: `${repo.name} is Up to Date`,
        message: 'No incoming commits. Working branch is fully synchronized.',
        timestamp: new Date().toISOString()
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
   * Notifies user that a Fast-Forward pull was completed successfully
   * @param {string} repoName 
   * @param {string} details 
   */
  notifyPullSuccess(repoName, details = '') {
    const title = `Pull Complete: ${repoName} Synchronized`;
    const body = `Latest changes fast-forward pulled successfully into local branch.`;

    this._sendNativeNotification(title, body, { type: 'success' });
  }

  /**
   * Notifies user that a Fast-Forward pull failed
   * @param {string} repoName 
   * @param {string} errorMessage 
   */
  notifyPullError(repoName, errorMessage) {
    const title = `Pull Failed: ${repoName}`;
    const body = errorMessage || 'Could not fast-forward branch from remote.';

    this._sendNativeNotification(title, body, { type: 'error' });
  }

  /**
   * Dispatches a test notification for user to confirm real-time alerts work
   */
  sendTestNotification() {
    const title = 'PullMate: Real-Time Alerts Active';
    const body = 'Desktop notifications and in-app sync alerts are configured and working!';

    this._sendNativeNotification(title, body, { type: 'success' });
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

      // If user performed manual "Check All", let them know everything is up to date in-app
      if (options?.manual) {
        this.onNotification({
          id: Date.now(),
          type: 'success',
          title: 'All Repositories Synchronized',
          message: 'All tracked repositories are up to date with remote.',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Windows Native Notification dispatch
    if (!settings.notificationsEnabled || quiet || snoozed) {
      return;
    }

    const isManual = Boolean(options?.manual);

    for (const item of behindRepos) {
      const { repo, status } = item;
      const history = this.notificationHistory.get(repo.id);
      const now = Date.now();

      // Trigger notification if:
      // 1. Manual check requested
      // 2. OR Repo is newly behind
      // 3. OR incoming commit count has changed
      // 4. OR 2 minutes have elapsed since the last alert (for real-time responsiveness)
      const shouldNotify = isManual ||
        !history ||
        (status.behindCount !== history.count) ||
        ((now - history.timestamp) > 2 * 60 * 1000);

      if (!shouldNotify) {
        continue;
      }

      this.notificationHistory.set(repo.id, {
        count: status.behindCount,
        timestamp: now
      });

      this._sendNativeNotification(
        `PullMate: ${repo.name} Needs Sync (${status.behindCount} new commit${status.behindCount > 1 ? 's' : ''})`,
        `Branch is ${status.behindCount} commit${status.behindCount > 1 ? 's' : ''} behind remote (${status.trackingBranch || 'origin'}). Fast-forward pull available.`,
        { type: 'warning', repoId: repo.id }
      );
    }

    // Reset notification history for repositories that are now up to date
    const currentRepos = this.repositoryService.getRepositories();
    for (const repo of currentRepos) {
      if (!behindRepos.some(b => b.repo.id === repo.id)) {
        this.notificationHistory.delete(repo.id);
      }
    }
  }

  _sendNativeNotification(title, body, options = {}) {
    // 1. Dispatch real-time in-app notification to renderer
    try {
      this.onNotification({
        id: Date.now(),
        type: options.type || 'info',
        title,
        message: body,
        repoId: options.repoId || null,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.warn('[ReminderService] In-app notification delivery failed:', err.message);
    }

    // 2. Dispatch Windows Native Toast notification
    try {
      if (Notification && Notification.isSupported && Notification.isSupported()) {
        const notifOptions = {
          title,
          body,
          silent: false,
          urgency: 'critical',
          timeoutType: 'default'
        };

        if (this.appIcon) {
          notifOptions.icon = this.appIcon;
        }

        const notification = new Notification(notifOptions);

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
