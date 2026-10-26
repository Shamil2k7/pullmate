import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

import GitService from '../electron/gitService.cjs';
import SettingsService from '../electron/settingsService.cjs';
import RepositoryService from '../electron/repositoryService.cjs';
import CredentialService from '../electron/credentialService.cjs';
import ReminderService from '../electron/reminderService.cjs';
import { formatRelativeTime, getStatusLabel, getStatusColor } from '../src/utils/formatTime.js';

describe('FormatTime Utilities', () => {
  it('formats status labels accurately', () => {
    expect(getStatusLabel('up_to_date')).toBe('Up to date');
    expect(getStatusLabel('behind')).toBe('Behind remote');
    expect(getStatusLabel('ahead')).toBe('Ahead of remote');
    expect(getStatusLabel('diverged')).toBe('Diverged branches');
    expect(getStatusLabel('uncommitted_changes')).toBe('Uncommitted changes');
    expect(getStatusLabel('unknown_state')).toBe('Unknown');
  });

  it('provides distinct colors for status types', () => {
    const upColor = getStatusColor('up_to_date');
    const behindColor = getStatusColor('behind');
    expect(upColor.text).toBe('#2E7D32');
    expect(behindColor.text).toBe('#E65100');
  });

  it('formats relative timestamps', () => {
    expect(formatRelativeTime(null)).toBe('Never');
    const now = new Date().toISOString();
    expect(formatRelativeTime(now)).toBe('Just now');
  });
});

describe('GitService Remote URL Parsing', () => {
  const gitService = new GitService();

  it('parses HTTPS GitHub URLs', () => {
    const res = gitService.parseRemoteUrl('https://github.com/torvalds/linux.git');
    expect(res).not.toBeNull();
    expect(res.owner).toBe('torvalds');
    expect(res.name).toBe('linux');
    expect(res.fullName).toBe('torvalds/linux');
  });

  it('parses HTTPS GitHub URLs without .git', () => {
    const res = gitService.parseRemoteUrl('https://github.com/facebook/react');
    expect(res).not.toBeNull();
    expect(res.owner).toBe('facebook');
    expect(res.name).toBe('react');
    expect(res.fullName).toBe('facebook/react');
  });

  it('parses SSH GitHub URLs', () => {
    const res = gitService.parseRemoteUrl('git@github.com:electron/electron.git');
    expect(res).not.toBeNull();
    expect(res.owner).toBe('electron');
    expect(res.name).toBe('electron');
    expect(res.fullName).toBe('electron/electron');
  });

  it('returns null for non-git / invalid strings', () => {
    expect(gitService.parseRemoteUrl('')).toBeNull();
    expect(gitService.parseRemoteUrl(null)).toBeNull();
    expect(gitService.parseRemoteUrl('not-a-url')).toBeNull();
  });
});

describe('SettingsService Local Persistence', () => {
  let tempDir;
  let settingsService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pullmate-settings-test-'));
    settingsService = new SettingsService(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('initializes with default settings', () => {
    const settings = settingsService.getSettings();
    expect(settings.onboardingCompleted).toBe(false);
    expect(settings.characterVisible).toBe(true);
    expect(settings.characterMinimized).toBe(false);
    expect(settings.checkIntervalMinutes).toBe(0.5);
  });

  it('persists and updates partial settings', () => {
    settingsService.updateSettings({
      onboardingCompleted: true,
      characterMinimized: true,
      checkIntervalMinutes: 60,
      characterPosition: { x: 450, y: 550 }
    });

    const refreshed = new SettingsService(tempDir).getSettings();
    expect(refreshed.onboardingCompleted).toBe(true);
    expect(refreshed.characterMinimized).toBe(true);
    expect(refreshed.checkIntervalMinutes).toBe(60);
    expect(refreshed.characterPosition.x).toBe(450);
    expect(refreshed.characterPosition.y).toBe(550);
  });
});

describe('RepositoryService Tracking & Safety', () => {
  let tempDir;
  let repoService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pullmate-repo-test-'));
    repoService = new RepositoryService(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('adds and lists tracked repositories', () => {
    const dummyPath = path.join(tempDir, 'dummy-project');
    fs.mkdirSync(dummyPath);

    const added = repoService.addRepository({
      name: 'dummy-project',
      fullName: 'user/dummy-project',
      owner: 'user',
      isPrivate: false,
      defaultBranch: 'main',
      localPath: dummyPath
    });

    expect(added.id).toBeDefined();
    expect(added.name).toBe('dummy-project');

    const all = repoService.getRepositories();
    expect(all.length).toBe(1);
    expect(all[0].name).toBe('dummy-project');
  });

  it('prevents duplicate repository paths from being tracked', () => {
    const dummyPath = path.join(tempDir, 'dummy-project-dup');
    fs.mkdirSync(dummyPath);

    repoService.addRepository({
      name: 'dummy-project-dup',
      localPath: dummyPath
    });

    expect(() => {
      repoService.addRepository({
        name: 'dummy-project-dup-2',
        localPath: dummyPath
      });
    }).toThrow(/already being tracked/);
  });

  it('updates repository status with Git metrics', () => {
    const dummyPath = path.join(tempDir, 'metrics-project');
    fs.mkdirSync(dummyPath);

    const added = repoService.addRepository({
      name: 'metrics-project',
      localPath: dummyPath
    });

    const updated = repoService.updateRepositoryStatus(added.id, {
      status: 'behind',
      behindCount: 4,
      aheadCount: 0,
      currentBranch: 'main',
      trackingBranch: 'origin/main',
      isClean: true,
      fetchSuccess: true
    });

    expect(updated.status).toBe('behind');
    expect(updated.behindCount).toBe(4);
    expect(updated.lastSuccessfulFetchAt).not.toBeNull();
  });

  it('removes repository from tracking without deleting files', () => {
    const dummyPath = path.join(tempDir, 'safe-delete-project');
    fs.mkdirSync(dummyPath);
    const testFile = path.join(dummyPath, 'code.js');
    fs.writeFileSync(testFile, 'console.log("safe");');

    const added = repoService.addRepository({
      name: 'safe-delete-project',
      localPath: dummyPath
    });

    const success = repoService.removeRepository(added.id);
    expect(success).toBe(true);

    const all = repoService.getRepositories();
    expect(all.length).toBe(0);

    // Verify local files are completely preserved
    expect(fs.existsSync(testFile)).toBe(true);
    expect(fs.readFileSync(testFile, 'utf-8')).toBe('console.log("safe");');
  });
});

describe('CredentialService DPAPI & Storage', () => {
  let tempDir;
  let credentialService;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pullmate-cred-test-'));
    credentialService = new CredentialService(tempDir);
  });

  afterEach(() => {
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it('saves, verifies, retrieves, and clears authentication token', async () => {
    expect(await credentialService.hasToken()).toBe(false);

    await credentialService.saveToken('gho_testToken1234567890');
    expect(await credentialService.hasToken()).toBe(true);

    const retrieved = await credentialService.getToken();
    expect(retrieved).toBe('gho_testToken1234567890');

    await credentialService.clearToken();
    expect(await credentialService.hasToken()).toBe(false);
    expect(await credentialService.getToken()).toBeNull();
  });
});

describe('ReminderService Quiet Hours & Snooze Logic', () => {
  const reminder = new ReminderService({
    gitService: {},
    repositoryService: {},
    settingsService: { getSettings: () => ({}) }
  });

  it('correctly evaluates snoozed state', () => {
    // Snoozed until future
    const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    expect(reminder.isSnoozed({ snoozeUntil: future })).toBe(true);

    // Expired snooze
    const past = new Date(Date.now() - 60 * 1000).toISOString();
    expect(reminder.isSnoozed({ snoozeUntil: past })).toBe(false);

    // Null snooze
    expect(reminder.isSnoozed({ snoozeUntil: null })).toBe(false);
  });

  it('disables quiet hours when toggle is off', () => {
    expect(reminder.isQuietHours({
      quietHoursEnabled: false,
      quietHoursStart: '22:00',
      quietHoursEnd: '08:00'
    })).toBe(false);
  });

  it('dispatches real-time in-app notifications on pull success, failure, and test', () => {
    const notifications = [];
    const service = new ReminderService({
      gitService: {},
      repositoryService: { getRepositories: () => [] },
      settingsService: { getSettings: () => ({ notificationsEnabled: true }) },
      onNotification: (notif) => notifications.push(notif)
    });

    service.notifyPullSuccess('my-cool-repo', 'Fast-forward updated');
    expect(notifications.length).toBe(1);
    expect(notifications[0].type).toBe('success');
    expect(notifications[0].title).toContain('my-cool-repo');

    service.notifyPullError('my-cool-repo', 'Uncommitted changes detected');
    expect(notifications.length).toBe(2);
    expect(notifications[1].type).toBe('error');
    expect(notifications[1].message).toContain('Uncommitted changes detected');

    service.sendTestNotification();
    expect(notifications.length).toBe(3);
    expect(notifications[2].type).toBe('success');
  });
});
