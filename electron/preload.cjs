const { contextBridge, ipcRenderer } = require('electron');

/**
 * Safe and narrow Preload Bridge exposing strictly validated IPC channels.
 * No node integration, no raw shell or filesystem access exposed to renderer.
 */
contextBridge.exposeInMainWorld('pullmateApi', {
  // GitHub Authentication
  auth: {
    startDeviceAuth: () => ipcRenderer.invoke('auth:start-device-flow'),
    cancelDeviceAuth: () => ipcRenderer.invoke('auth:cancel-device-flow'),
    getUserProfile: () => ipcRenderer.invoke('auth:get-user-profile'),
    getUserRepositories: (page = 1, perPage = 50) => ipcRenderer.invoke('auth:get-user-repos', { page, perPage }),
    disconnect: () => ipcRenderer.invoke('auth:disconnect'),
    hasAuth: () => ipcRenderer.invoke('auth:has-token'),
    setClientId: (clientId) => ipcRenderer.invoke('auth:set-client-id', clientId),
    getClientId: () => ipcRenderer.invoke('auth:get-client-id'),
    onAuthProgress: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('auth:progress', handler);
      return () => ipcRenderer.removeListener('auth:progress', handler);
    }
  },

  // Repositories
  repositories: {
    getAll: () => ipcRenderer.invoke('repos:get-all'),
    add: (repoData) => ipcRenderer.invoke('repos:add', repoData),
    remove: (repoId) => ipcRenderer.invoke('repos:remove', repoId),
    validateFolder: (folderPath) => ipcRenderer.invoke('repos:validate-folder', folderPath),
    selectDirectory: () => ipcRenderer.invoke('repos:select-directory'),
    clone: (cloneUrl, parentDir, folderName) => ipcRenderer.invoke('repos:clone', { cloneUrl, parentDir, folderName }),
    checkStatus: (repoId) => ipcRenderer.invoke('repos:check-status', repoId),
    checkAll: () => ipcRenderer.invoke('repos:check-all'),
    pull: (repoId) => ipcRenderer.invoke('repos:safe-pull', repoId),
    openFolder: (localPath) => ipcRenderer.invoke('repos:open-folder', localPath),
    openExternal: (url) => ipcRenderer.invoke('repos:open-external', url),
    onUpdated: (callback) => {
      const handler = () => callback();
      ipcRenderer.on('repos:updated', handler);
      return () => ipcRenderer.removeListener('repos:updated', handler);
    },
    onCloneProgress: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('repos:clone-progress', handler);
      return () => ipcRenderer.removeListener('repos:clone-progress', handler);
    }
  },

  // Settings
  settings: {
    get: () => ipcRenderer.invoke('settings:get'),
    update: (partial) => ipcRenderer.invoke('settings:update', partial),
    reset: (fullReset = false) => ipcRenderer.invoke('settings:reset', fullReset),
    onChanged: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('settings:changed', handler);
      return () => ipcRenderer.removeListener('settings:changed', handler);
    }
  },

  // Character Companion (Pip)
  character: {
    getState: () => ipcRenderer.invoke('pip:get-state'),
    savePosition: (x, y) => ipcRenderer.invoke('pip:save-position', { x, y }),
    hide: () => ipcRenderer.invoke('pip:hide'),
    show: () => ipcRenderer.invoke('pip:show'),
    minimize: () => ipcRenderer.invoke('pip:minimize'),
    restore: () => ipcRenderer.invoke('pip:restore'),
    toggleMinimize: () => ipcRenderer.invoke('pip:toggle-minimize'),
    isMinimized: () => ipcRenderer.invoke('pip:is-minimized'),
    openMainWindow: () => ipcRenderer.invoke('pip:open-main-window'),
    onStateChanged: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('pip:state-changed', handler);
      return () => ipcRenderer.removeListener('pip:state-changed', handler);
    }
  },

  // Notifications & Real-Time Alerts
  notifications: {
    onNotification: (callback) => {
      const handler = (_event, data) => callback(data);
      ipcRenderer.on('notification:show', handler);
      return () => ipcRenderer.removeListener('notification:show', handler);
    },
    testNotification: () => ipcRenderer.invoke('system:test-notification')
  },

  // Reminders & System
  system: {
    snooze: (hours) => ipcRenderer.invoke('system:snooze', hours),
    clearSnooze: () => ipcRenderer.invoke('system:clear-snooze'),
    checkGitInstalled: () => ipcRenderer.invoke('system:check-git'),
    testNotification: () => ipcRenderer.invoke('system:test-notification')
  }
});
