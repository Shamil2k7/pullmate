const { app, BrowserWindow, ipcMain, dialog, shell, screen, powerMonitor } = require('electron');
const path = require('path');
const CredentialService = require('./credentialService.cjs');
const SettingsService = require('./settingsService.cjs');
const RepositoryService = require('./repositoryService.cjs');
const GitService = require('./gitService.cjs');
const GitHubService = require('./githubService.cjs');
const StartupService = require('./startupService.cjs');
const ReminderService = require('./reminderService.cjs');
const TrayService = require('./trayService.cjs');
const GitWatcher = require('./gitWatcher.cjs');

// Set App User Model ID on Windows so Action Center / Toast notifications work reliably
if (process.platform === 'win32') {
  try {
    app.setAppUserModelId('com.pullmate.app');
  } catch (err) {
    console.warn('[Main] setAppUserModelId failed:', err.message);
  }
}

// Single instance lock
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
  process.exit(0);
}

// Global references
let mainWindow = null;
let characterWindow = null;
let trayService = null;
let reminderService = null;
let gitWatcher = null;
let isQuitting = false;
let isPipMinimized = false;
let savedNormalCharacterPosition = null;
let savedMinimizedPosition = null;

// Current state for Pip character
let currentPipState = {
  state: 'idle',
  message: 'Hello! I am Pip, your Git companion.',
  action: null,
  isMinimized: false
};

// Initialize Core Services
const credentialService = new CredentialService();
const settingsService = new SettingsService();
const repositoryService = new RepositoryService();
const gitService = new GitService();
const githubService = new GitHubService();
const startupService = new StartupService();

const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

function broadcastPipState(stateObj) {
  // If Pip is currently minimized and a new update arrives, automatically open (restore) Pip!
  if (isPipMinimized && (stateObj.state === 'updates_available' || stateObj.hasUpdate)) {
    restoreCharacterWindow();
  }

  currentPipState = { ...currentPipState, ...stateObj, isMinimized: isPipMinimized };
  if (characterWindow && !characterWindow.isDestroyed()) {
    characterWindow.webContents.send('pip:state-changed', currentPipState);
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('pip:state-changed', currentPipState);
  }
}

function broadcastRepositoriesUpdated() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('repos:updated');
  }
  if (gitWatcher) {
    gitWatcher.syncWatchers();
  }
}

function broadcastNotification(notifObj) {
  if (isPipMinimized && (notifObj?.type === 'updates_available' || notifObj?.isUpdate)) {
    restoreCharacterWindow();
  }
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('notification:show', notifObj);
  }
}

function broadcastSettingsChanged(newSettings) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings:changed', newSettings);
  }
  if (characterWindow && !characterWindow.isDestroyed()) {
    characterWindow.webContents.send('settings:changed', newSettings);
  }
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 920,
    minHeight: 620,
    backgroundColor: '#FAFAF9',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  mainWindow.setMenuBarVisibility(false);

  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => {
    // Check if launched with --hidden flag (Windows startup)
    const isHiddenLaunch = process.argv.includes('--hidden');
    if (!isHiddenLaunch) {
      mainWindow.show();
    }
  });

  mainWindow.on('close', (event) => {
    const settings = settingsService.getSettings();
    if (!isQuitting && settings.minimizeToTray) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // Automatically check for incoming collaborator updates whenever the user focuses or shows the window
  let lastFocusCheckTime = 0;
  mainWindow.on('focus', () => {
    const now = Date.now();
    const settings = settingsService.getSettings();
    if (settings.autoCheckOnFocus !== false && reminderService && now - lastFocusCheckTime > 5000) {
      lastFocusCheckTime = now;
      reminderService.checkAll({ isFocusCheck: true });
    }
  });

  mainWindow.on('show', () => {
    const now = Date.now();
    const settings = settingsService.getSettings();
    if (settings.autoCheckOnFocus !== false && reminderService && now - lastFocusCheckTime > 5000) {
      lastFocusCheckTime = now;
      reminderService.checkAll({ isShowCheck: true });
    }
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url !== mainWindow.webContents.getURL()) {
      event.preventDefault();
      if (url.startsWith('https:') || url.startsWith('http:')) {
        shell.openExternal(url);
      }
    }
  });
}

function createCharacterWindow() {
  const settings = settingsService.getSettings();
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x: workX, y: workY, width: screenWidth, height: screenHeight } = primaryDisplay.workArea;

  const normalWidth = 300;
  const normalHeight = 280;
  const miniSize = 72;

  const isMini = Boolean(settings.characterMinimized);
  isPipMinimized = isMini;

  const winWidth = isMini ? miniSize : normalWidth;
  const winHeight = isMini ? miniSize : normalHeight;

  let x, y;
  if (isMini) {
    x = settings.minimizedPosition && typeof settings.minimizedPosition.x === 'number'
      ? settings.minimizedPosition.x
      : workX + 24;
    y = settings.minimizedPosition && typeof settings.minimizedPosition.y === 'number'
      ? settings.minimizedPosition.y
      : workY + screenHeight - miniSize - 24;
  } else {
    x = settings.characterPosition && typeof settings.characterPosition.x === 'number'
      ? settings.characterPosition.x
      : workX + screenWidth - normalWidth - 30;

    y = settings.characterPosition && typeof settings.characterPosition.y === 'number'
      ? settings.characterPosition.y
      : workY + screenHeight - normalHeight - 30;

    // Clamp within visible display area
    x = Math.max(workX + 10, Math.min(x, workX + screenWidth - normalWidth - 10));
    y = Math.max(workY + 10, Math.min(y, workY + screenHeight - normalHeight - 10));
  }

  characterWindow = new BrowserWindow({
    title: '',
    width: winWidth,
    height: winHeight,
    x,
    y,
    frame: false,
    transparent: true,
    alwaysOnTop: Boolean(settings.characterAlwaysOnTop),
    skipTaskbar: true,
    resizable: false,
    hasShadow: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  });

  if (isDev) {
    characterWindow.loadURL('http://localhost:5173/?mode=character');
  } else {
    characterWindow.loadFile(path.join(__dirname, '../dist/index.html'), {
      query: { mode: 'character' }
    });
  }

  characterWindow.once('ready-to-show', () => {
    if (settings.characterVisible) {
      characterWindow.show();
    }
  });

  characterWindow.on('moved', () => {
    if (!characterWindow || characterWindow.isDestroyed()) return;
    const [curX, curY] = characterWindow.getPosition();
    if (isPipMinimized) {
      savedMinimizedPosition = { x: curX, y: curY };
      settingsService.updateSettings({
        minimizedPosition: { x: curX, y: curY }
      });
    } else {
      savedNormalCharacterPosition = { x: curX, y: curY };
      settingsService.updateSettings({
        characterPosition: { x: curX, y: curY }
      });
    }
  });

  characterWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
}

function minimizeCharacterWindow() {
  if (!characterWindow || characterWindow.isDestroyed() || isPipMinimized) return;

  const [curX, curY] = characterWindow.getPosition();
  savedNormalCharacterPosition = { x: curX, y: curY };

  const settings = settingsService.getSettings();
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x: workX, y: workY, height: workHeight } = primaryDisplay.workArea;

  const miniSize = 72;
  const miniX = savedMinimizedPosition?.x ?? settings.minimizedPosition?.x ?? (workX + 24);
  const miniY = savedMinimizedPosition?.y ?? settings.minimizedPosition?.y ?? (workY + workHeight - miniSize - 24);

  isPipMinimized = true;
  settingsService.updateSettings({ characterMinimized: true });

  characterWindow.setBounds({
    x: miniX,
    y: miniY,
    width: miniSize,
    height: miniSize
  });

  characterWindow.setAlwaysOnTop(true);
  broadcastPipState({ isMinimized: true });
  broadcastSettingsChanged(settingsService.getSettings());
  if (trayService) trayService.updateContextMenu();
}

function restoreCharacterWindow() {
  if (!characterWindow || characterWindow.isDestroyed() || !isPipMinimized) return;

  const settings = settingsService.getSettings();
  const primaryDisplay = screen.getPrimaryDisplay();
  const { x: workX, y: workY, width: workWidth, height: workHeight } = primaryDisplay.workArea;

  const normalWidth = 300;
  const normalHeight = 280;

  let targetX = savedNormalCharacterPosition?.x ?? settings.characterPosition?.x ?? (workX + workWidth - normalWidth - 30);
  let targetY = savedNormalCharacterPosition?.y ?? settings.characterPosition?.y ?? (workY + workHeight - normalHeight - 30);

  targetX = Math.max(workX + 10, Math.min(targetX, workX + workWidth - normalWidth - 10));
  targetY = Math.max(workY + 10, Math.min(targetY, workY + workHeight - normalHeight - 10));

  isPipMinimized = false;
  settingsService.updateSettings({ characterMinimized: false });

  characterWindow.setBounds({
    x: targetX,
    y: targetY,
    width: normalWidth,
    height: normalHeight
  });

  characterWindow.setAlwaysOnTop(Boolean(settings.characterAlwaysOnTop));
  broadcastPipState({ isMinimized: false });
  broadcastSettingsChanged(settingsService.getSettings());
  if (trayService) trayService.updateContextMenu();
}

function toggleMinimizeCharacterWindow() {
  if (isPipMinimized) {
    restoreCharacterWindow();
  } else {
    minimizeCharacterWindow();
  }
}

function showMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
  } else {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
}

function toggleCharacterWindow() {
  const settings = settingsService.getSettings();
  const newVisibility = !settings.characterVisible;
  settingsService.updateSettings({ characterVisible: newVisibility });

  if (characterWindow && !characterWindow.isDestroyed()) {
    if (newVisibility) {
      characterWindow.show();
    } else {
      characterWindow.hide();
    }
  }

  if (trayService) {
    trayService.updateContextMenu();
  }

  broadcastSettingsChanged(settingsService.getSettings());
}

// App lifecycle
app.whenReady().then(async () => {
  // Initialize Reminder Service with Real-Time Notification delivery
  reminderService = new ReminderService({
    gitService,
    repositoryService,
    settingsService,
    onPipStateChange: broadcastPipState,
    onRepositoriesChange: broadcastRepositoriesUpdated,
    onSettingsChange: broadcastSettingsChanged,
    onShowMainWindow: showMainWindow,
    onNotification: broadcastNotification
  });

  // Initialize Real-time Local Git Filesystem Watcher
  gitWatcher = new GitWatcher({
    gitService,
    repositoryService,
    onRepositoriesChange: broadcastRepositoriesUpdated,
    onPipStateChange: broadcastPipState
  });
  gitWatcher.syncWatchers();

  // Initialize System Tray
  trayService = new TrayService({
    onOpenDashboard: showMainWindow,
    onCheckAll: () => reminderService.checkAll({ manual: true }),
    onToggleCharacter: toggleCharacterWindow,
    onToggleMinimizeCharacter: toggleMinimizeCharacterWindow,
    onSnooze: (hours) => {
      if (hours === 0) reminderService.clearSnooze();
      else reminderService.snooze(hours);
    },
    onOpenSettings: () => {
      showMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('navigate-to', 'settings');
      }
    },
    onQuit: () => {
      isQuitting = true;
      app.quit();
    },
    getCharacterVisibility: () => settingsService.getSettings().characterVisible,
    getCharacterMinimized: () => isPipMinimized
  });
  trayService.init();

  // Create UI Windows
  createMainWindow();
  createCharacterWindow();

  // Start background reminder scheduler
  reminderService.start();

  // Listen for sleep / wake
  powerMonitor.on('resume', () => {
    console.log('[App] System resumed from sleep, queuing sync check...');
    setTimeout(() => {
      reminderService.checkAll({ isResumeCheck: true });
    }, 5000);
  });
});

app.on('second-instance', () => {
  showMainWindow();
});

app.on('activate', () => {
  showMainWindow();
});

app.on('before-quit', () => {
  isQuitting = true;
  if (gitWatcher) {
    gitWatcher.close();
  }
});

// ==========================================
// IPC HANDLERS WITH STRICT INPUT VALIDATION
// ==========================================

// --- GitHub Auth Handlers ---
ipcMain.handle('auth:get-client-id', () => {
  return githubService.getClientId();
});

ipcMain.handle('auth:set-client-id', (_event, clientId) => {
  if (typeof clientId === 'string') {
    githubService.setClientId(clientId.trim());
    return true;
  }
  return false;
});

ipcMain.handle('auth:has-token', async () => {
  return credentialService.hasToken();
});

ipcMain.handle('auth:start-device-flow', async (event) => {
  try {
    const codeData = await githubService.requestDeviceCode();

    // Start background polling
    githubService.pollForToken(
      codeData.device_code,
      codeData.interval,
      codeData.expires_in,
      (progress) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send('auth:progress', progress);
        }
      }
    ).then(async (token) => {
      await credentialService.saveToken(token);
      // Fetch user profile
      const userProfile = await githubService.getUserProfile(token);
      settingsService.updateSettings({ userProfile });
      broadcastPipState({
        state: 'celebrating',
        message: `Welcome, ${userProfile.name || userProfile.login}! GitHub connected successfully.`,
        action: null
      });
      if (!event.sender.isDestroyed()) {
        event.sender.send('auth:progress', { status: 'complete', user: userProfile });
      }
    }).catch((err) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('auth:progress', { status: 'error', error: err.message });
      }
    });

    return {
      success: true,
      user_code: codeData.user_code,
      verification_uri: codeData.verification_uri,
      expires_in: codeData.expires_in
    };
  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
});

ipcMain.handle('auth:cancel-device-flow', () => {
  githubService.cancelPolling();
  return true;
});

ipcMain.handle('auth:get-user-profile', async () => {
  const token = await credentialService.getToken();
  if (!token) return null;
  try {
    const profile = await githubService.getUserProfile(token);
    settingsService.updateSettings({ userProfile: profile });
    return profile;
  } catch (err) {
    console.warn('[IPC] Failed to fetch user profile:', err.message);
    return settingsService.getSettings().userProfile;
  }
});

ipcMain.handle('auth:get-user-repos', async (_event, { page = 1, perPage = 50 }) => {
  const token = await credentialService.getToken();
  if (!token) throw new Error('Not authenticated with GitHub');
  return githubService.getUserRepositories(token, page, perPage);
});

ipcMain.handle('auth:disconnect', async () => {
  githubService.cancelPolling();
  await credentialService.clearToken();
  settingsService.updateSettings({ userProfile: null });
  broadcastPipState({
    state: 'idle',
    message: 'GitHub disconnected. You can reconnect anytime!',
    action: null
  });
  return true;
});

// --- Repository Handlers ---
ipcMain.handle('repos:get-all', () => {
  return repositoryService.getRepositories();
});

ipcMain.handle('repos:add', (_event, repoData) => {
  if (!repoData || !repoData.localPath) {
    throw new Error('Local repository path is required');
  }
  const added = repositoryService.addRepository(repoData);
  broadcastRepositoriesUpdated();

  // Immediately check newly added repository
  if (reminderService) {
    setTimeout(() => {
      reminderService.checkRepository(added.id).catch(err => {
        console.warn('[Main] Immediate check for added repo failed:', err.message);
      });
    }, 500);
  }

  return added;
});

ipcMain.handle('repos:remove', (_event, repoId) => {
  if (!repoId || typeof repoId !== 'string') throw new Error('Invalid repository ID');
  const removed = repositoryService.removeRepository(repoId);
  broadcastRepositoriesUpdated();
  return removed;
});

ipcMain.handle('repos:validate-folder', async (_event, folderPath) => {
  return gitService.validateLocalFolder(folderPath);
});

ipcMain.handle('repos:select-directory', async (event) => {
  const win = (event && event.sender && BrowserWindow.fromWebContents(event.sender)) || mainWindow;
  const result = await dialog.showOpenDialog(win, {
    properties: ['openDirectory', 'createDirectory'],
    title: 'Select Repository Folder'
  });
  if (result.canceled || result.filePaths.length === 0) {
    return null;
  }
  return result.filePaths[0];
});

ipcMain.handle('repos:clone', async (event, { cloneUrl, parentDir, folderName }) => {
  if (!cloneUrl || !parentDir || !folderName) {
    throw new Error('cloneUrl, parentDir, and folderName are required');
  }

  const result = await gitService.cloneRepository(
    cloneUrl,
    parentDir,
    folderName,
    (progressStr) => {
      if (!event.sender.isDestroyed()) {
        event.sender.send('repos:clone-progress', progressStr);
      }
    }
  );

  return result;
});

ipcMain.handle('repos:check-status', async (_event, repoId) => {
  return reminderService.checkRepository(repoId);
});

ipcMain.handle('repos:check-all', async () => {
  return reminderService.checkAll({ manual: true });
});

ipcMain.handle('repos:safe-pull', async (_event, repoId) => {
  const repos = repositoryService.getRepositories();
  const repo = repos.find(r => r.id === repoId);
  if (!repo) throw new Error('Repository not found');

  broadcastPipState({
    state: 'checking',
    message: `Pulling updates for ${repo.name}...`,
    action: null
  });

  try {
    const pullResult = await gitService.safePull(repo.localPath);
    repositoryService.updateRepositoryStatus(repo.id, pullResult.status);
    broadcastRepositoriesUpdated();

    broadcastPipState({
      state: 'celebrating',
      message: `Pulled latest changes for ${repo.name}! You are synchronized.`,
      action: null
    });

    // Notify user in real time about successful fast-forward pull
    reminderService.notifyPullSuccess(repo.name, pullResult.message);

    return pullResult;
  } catch (err) {
    console.error(`[IPC] Safe pull failed for ${repo.name}:`, err.message);

    broadcastPipState({
      state: 'error',
      message: `Pull failed for ${repo.name}: ${err.message}`,
      action: null
    });

    // Notify user about pull failure in real time
    reminderService.notifyPullError(repo.name, err.message);

    throw err;
  }
});

ipcMain.handle('repos:open-folder', async (_event, localPath) => {
  if (!localPath || typeof localPath !== 'string') return false;
  shell.openPath(localPath);
  return true;
});

ipcMain.handle('repos:open-external', async (_event, url) => {
  if (url && (url.startsWith('https://') || url.startsWith('http://'))) {
    shell.openExternal(url);
    return true;
  }
  return false;
});

// --- Settings Handlers ---
ipcMain.handle('settings:get', () => {
  return settingsService.getSettings();
});

ipcMain.handle('settings:update', (_event, partial) => {
  const updated = settingsService.updateSettings(partial);

  // If startup setting changed, apply to OS
  if (partial.startupEnabled !== undefined) {
    startupService.setStartup(partial.startupEnabled);
  }

  // If character visibility changed, sync character window
  if (partial.characterVisible !== undefined && characterWindow && !characterWindow.isDestroyed()) {
    if (partial.characterVisible) characterWindow.show();
    else characterWindow.hide();
    if (trayService) trayService.updateContextMenu();
  }

  // If character minimized state changed, apply
  if (partial.characterMinimized !== undefined) {
    if (partial.characterMinimized) {
      minimizeCharacterWindow();
    } else {
      restoreCharacterWindow();
    }
  }

  // If always on top changed
  if (partial.characterAlwaysOnTop !== undefined && characterWindow && !characterWindow.isDestroyed()) {
    characterWindow.setAlwaysOnTop(Boolean(partial.characterAlwaysOnTop));
  }

  // If check interval or onboarding completion changed, restart reminder service
  if (partial.checkIntervalMinutes !== undefined || partial.onboardingCompleted !== undefined) {
    reminderService.restart();
  }

  broadcastSettingsChanged(updated);
  return updated;
});

ipcMain.handle('settings:reset', (_event, fullReset) => {
  const reset = settingsService.resetSettings(fullReset);
  broadcastSettingsChanged(reset);
  return reset;
});

// --- Pip Character Companion Handlers ---
ipcMain.handle('pip:get-state', () => {
  return { ...currentPipState, isMinimized: isPipMinimized };
});

ipcMain.handle('pip:minimize', () => {
  minimizeCharacterWindow();
  return true;
});

ipcMain.handle('pip:restore', () => {
  restoreCharacterWindow();
  return true;
});

ipcMain.handle('pip:toggle-minimize', () => {
  toggleMinimizeCharacterWindow();
  return isPipMinimized;
});

ipcMain.handle('pip:is-minimized', () => {
  return isPipMinimized;
});

ipcMain.on('pip:move-by', (_event, { dx, dy }) => {
  if (!characterWindow || characterWindow.isDestroyed()) return;
  const [curX, curY] = characterWindow.getPosition();
  characterWindow.setPosition(curX + dx, curY + dy);
});

ipcMain.handle('pip:save-minimized-position', () => {
  if (!characterWindow || characterWindow.isDestroyed()) return;
  const [curX, curY] = characterWindow.getPosition();
  savedMinimizedPosition = { x: curX, y: curY };
  settingsService.updateSettings({ minimizedPosition: { x: curX, y: curY } });
  return true;
});

ipcMain.handle('pip:save-position', (_event, { x, y }) => {
  if (typeof x === 'number' && typeof y === 'number') {
    settingsService.updateSettings({ characterPosition: { x, y } });
  }
  return true;
});

ipcMain.handle('pip:hide', () => {
  settingsService.updateSettings({ characterVisible: false });
  if (characterWindow && !characterWindow.isDestroyed()) {
    characterWindow.hide();
  }
  if (trayService) trayService.updateContextMenu();
  broadcastSettingsChanged(settingsService.getSettings());
  return true;
});

ipcMain.handle('pip:show', () => {
  settingsService.updateSettings({ characterVisible: true });
  if (characterWindow && !characterWindow.isDestroyed()) {
    characterWindow.show();
  }
  if (trayService) trayService.updateContextMenu();
  broadcastSettingsChanged(settingsService.getSettings());
  return true;
});

ipcMain.handle('pip:open-main-window', () => {
  showMainWindow();
  return true;
});

// --- System & Snooze Handlers ---
ipcMain.handle('system:snooze', (_event, hours) => {
  reminderService.snooze(hours || 2);
  return true;
});

ipcMain.handle('system:clear-snooze', () => {
  reminderService.clearSnooze();
  return true;
});

ipcMain.handle('system:check-git', async () => {
  return gitService.checkGitInstalled();
});

ipcMain.handle('system:test-notification', () => {
  if (reminderService) {
    reminderService.sendTestNotification();
    return true;
  }
  return false;
});
