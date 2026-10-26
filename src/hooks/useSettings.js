import { useState, useEffect, useCallback } from 'react';

export function useSettings() {
  const [settings, setSettings] = useState({
    onboardingCompleted: false,
    startupEnabled: false,
    characterVisible: true,
    characterAlwaysOnTop: true,
    characterPosition: { x: null, y: null },
    notificationsEnabled: true,
    checkIntervalMinutes: 30,
    checkOnStartup: true,
    quietHoursEnabled: false,
    quietHoursStart: '22:00',
    quietHoursEnd: '08:00',
    snoozeUntil: null,
    minimizeToTray: true,
    theme: 'light',
    userProfile: null,
    lastGlobalCheckAt: null
  });
  const [loading, setLoading] = useState(true);

  const loadSettings = useCallback(async () => {
    if (!window.pullmateApi?.settings) return;
    try {
      const data = await window.pullmateApi.settings.get();
      if (data) {
        setSettings(data);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettings();

    if (window.pullmateApi?.settings?.onChanged) {
      const unsubscribe = window.pullmateApi.settings.onChanged((newSettings) => {
        setSettings(newSettings);
      });
      return () => unsubscribe();
    }
  }, [loadSettings]);

  const updateSettings = useCallback(async (partial) => {
    if (!window.pullmateApi?.settings) return;
    try {
      const updated = await window.pullmateApi.settings.update(partial);
      setSettings(updated);
      return updated;
    } catch (err) {
      console.error('Failed to update settings:', err);
      throw err;
    }
  }, []);

  const resetSettings = useCallback(async (fullReset = false) => {
    if (!window.pullmateApi?.settings) return;
    try {
      const reset = await window.pullmateApi.settings.reset(fullReset);
      setSettings(reset);
      return reset;
    } catch (err) {
      console.error('Failed to reset settings:', err);
    }
  }, []);

  return {
    settings,
    loading,
    updateSettings,
    resetSettings,
    refreshSettings: loadSettings
  };
}
