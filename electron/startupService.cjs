const { app } = require('electron');

class StartupService {
  /**
   * Sets whether PullMate starts on Windows login
   * @param {boolean} enable 
   */
  setStartup(enable) {
    try {
      if (app.isPackaged) {
        app.setLoginItemSettings({
          openAtLogin: Boolean(enable),
          openAsHidden: true,
          path: process.execPath,
          args: ['--hidden']
        });
      } else {
        // In dev mode, we can register or log for development
        console.log(`[StartupService] Set openAtLogin: ${enable} (packaged: ${app.isPackaged})`);
      }
      return true;
    } catch (err) {
      console.error('[StartupService] Failed to set login item settings:', err.message);
      return false;
    }
  }

  /**
   * Gets current Windows login item setting
   * @returns {boolean}
   */
  isStartupEnabled() {
    try {
      const settings = app.getLoginItemSettings();
      return Boolean(settings.openAtLogin);
    } catch (err) {
      console.error('[StartupService] Error getting login item settings:', err.message);
      return false;
    }
  }
}

module.exports = StartupService;
