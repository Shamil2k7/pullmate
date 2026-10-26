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
let isQuitting = false;

// Current state for Pip character
let currentPipState = {
  state: 'idle',
  message: 'Hello! I am Pip, your Git companion.',
  action: null
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
  currentPipState = { ...currentPipState, ...stateObj };
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
  const { width: screenWidth, height: screenHeight } = primaryDisplay.workAreaSize;

  const winWidth = 300;
  const winHeight = 280;

  let x = settings.characterPosition && typeof settings.characterPosition.x === 'number'
    ? settings.characterPosition.x
    : screenWidth - winWidth - 30;

  let y = settings.characterPosition && typeof settings.characterPosition.y === 'number'
    ? settings.characterPosition.y
    : screenHeight - winHeight - 30;

  // Clamp within visible display area
  x = Math.max(10, Math.min(x, screenWidth - winWidth - 10));
  y = Math.max(10, Math.min(y, screenHeight - winHeight - 10));

  characterWindow = new BrowserWindow({
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
    settingsService.updateSettings({
      characterPosition: { x: curX, y: curY }
    });
  });

  characterWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
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
  // Initialize Reminder Service
  reminderService = new ReminderService({
    gitService,
    repositoryService,
    settingsService,
    onPipStateChange: broadcastPipState,
    onRepositoriesChange: broadcastRepositoriesUpdated,
    onShowMainWindow: showMainWindow
  });

  // Initialize System Tray
  trayService = new TrayService({
    onOpenDashboard: showMainWindow,
    onCheckAll: () => reminderService.checkAll({ manual: true }),
    onToggleCharacter: toggleCharacterWindow,
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
    getCharacterVisibility: () => settingsService.getSettings().characterVisible
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

ipcMain.handle('repos:select-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
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

  const pullResult = await gitService.safePull(repo.localPath);
  repositoryService.updateRepositoryStatus(repo.id, pullResult.status);
  broadcastRepositoriesUpdated();

  broadcastPipState({
    state: 'celebrating',
    message: `Pulled latest changes for ${repo.name}! You are synchronized.`,
    action: null
  });

  return pullResult;
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

  // If always on top changed
  if (partial.characterAlwaysOnTop !== undefined && characterWindow && !characterWindow.isDestroyed()) {
    characterWindow.setAlwaysOnTop(Boolean(partial.characterAlwaysOnTop));
  }

  // If check interval changed, restart reminder service
  if (partial.checkIntervalMinutes !== undefined) {
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
  return currentPipState;
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
