const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const DEFAULT_SETTINGS = {
  onboardingCompleted: false,
  startupEnabled: false,
  characterVisible: true,
  characterAlwaysOnTop: true,
  characterPosition: { x: null, y: null },
  notificationsEnabled: true,
  checkIntervalMinutes: 1,
  checkOnStartup: true,
  quietHoursEnabled: false,
  quietHoursStart: '22:00',
  quietHoursEnd: '08:00',
  snoozeUntil: null,
  minimizeToTray: true,
  theme: 'light',
  userProfile: null,
  lastGlobalCheckAt: null
};

class SettingsService {
  constructor(customStorageDir = null) {
    this.storageDir = customStorageDir || (app ? app.getPath('userData') : path.join(process.cwd(), '.userData'));
    this.settingsFilePath = path.join(this.storageDir, 'settings.json');
    this.cachedSettings = null;
  }

  _ensureDir() {
    if (!fs.existsSync(this.storageDir)) {
      fs.mkdirSync(this.storageDir, { recursive: true });
    }
  }

  /**
   * Retrieves current application settings with defaults merged
   * @returns {object} settings
   */
  getSettings() {
    if (this.cachedSettings) {
      return { ...this.cachedSettings };
    }

    this._ensureDir();

    if (!fs.existsSync(this.settingsFilePath)) {
      this.cachedSettings = { ...DEFAULT_SETTINGS };
      this._saveToDisk(this.cachedSettings);
      return { ...this.cachedSettings };
    }

    try {
      const data = fs.readFileSync(this.settingsFilePath, 'utf-8');
      const parsed = JSON.parse(data);
      this.cachedSettings = { ...DEFAULT_SETTINGS, ...parsed };
      return { ...this.cachedSettings };
    } catch (err) {
      console.error('[SettingsService] Failed to read settings, recovering with defaults:', err.message);
      this.cachedSettings = { ...DEFAULT_SETTINGS };
      return { ...this.cachedSettings };
    }
  }

  /**
   * Updates partial settings and saves to disk
   * @param {object} partialSettings 
   * @returns {object} updated settings
   */
  updateSettings(partialSettings) {
    if (!partialSettings || typeof partialSettings !== 'object') {
      return this.getSettings();
    }

    const current = this.getSettings();
    const updated = {
      ...current,
      ...partialSettings
    };

    // Keep position valid
    if (partialSettings.characterPosition) {
      updated.characterPosition = {
        ...current.characterPosition,
        ...partialSettings.characterPosition
      };
    }

    this.cachedSettings = updated;
    this._saveToDisk(updated);
    return { ...updated };
  }

  /**
   * Resets settings back to defaults (excluding onboarding status if kept)
   * @param {boolean} fullReset
   */
  resetSettings(fullReset = false) {
    this.cachedSettings = { ...DEFAULT_SETTINGS };
    if (!fullReset) {
      // Keep user profile cleared but structure clean
    }
    this._saveToDisk(this.cachedSettings);
    return { ...this.cachedSettings };
  }

  _saveToDisk(settings) {
    this._ensureDir();
    try {
      fs.writeFileSync(this.settingsFilePath, JSON.stringify(settings, null, 2), 'utf-8');
    } catch (err) {
      console.error('[SettingsService] Failed to write settings to disk:', err.message);
    }
  }
}

module.exports = SettingsService;
