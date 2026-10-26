import React from 'react';
import { Info, Bell, Clock, Monitor, Eye, Moon, ShieldCheck } from 'lucide-react';

export default function ReminderSettings({ settings, onUpdateSettings, isWizard = false, onNext, onBack }) {
  const handleToggle = (key) => {
    onUpdateSettings({ [key]: !settings[key] });
  };

  const handleChange = (key, value) => {
    onUpdateSettings({ [key]: value });
  };

  return (
    <div className={isWizard ? 'wizard-step-container' : 'settings-section-container'}>
      {isWizard && (
        <div className="wizard-step-header">
          <h2 className="step-title">Reminder Preferences</h2>
          <p className="step-description">
            Customize how and when Pip watches your repositories and notifies you.
          </p>
        </div>
      )}

      {/* Educational Notice: Fetch vs Pull */}
      <div className="education-callout-card">
        <div className="callout-icon-box">
          <Info size={18} className="text-accent" />
        </div>
        <div className="callout-content">
          <h4>How PullMate Works</h4>
          <p>
            PullMate runs background <strong>Git fetch</strong> operations to compare your local branch against GitHub without modifying your files.
            It will <strong>never pull or merge automatically</strong> — merging changes always remains your deliberate choice to prevent merge conflicts.
          </p>
        </div>
      </div>

      <div className="preferences-grid">
        {/* Startup Preference */}
        <div className="preference-item">
          <div className="preference-info">
            <div className="preference-title-row">
              <Monitor size={16} />
              <span className="pref-title">Launch on Windows Startup</span>
            </div>
            <p className="pref-desc">
              Automatically launch PullMate in the background when you log into Windows so you never forget to sync.
            </p>
          </div>
          <div className="preference-control">
            <label className="switch">
              <input
                type="checkbox"
                checked={Boolean(settings.startupEnabled)}
                onChange={() => handleToggle('startupEnabled')}
              />
              <span className="slider round" />
            </label>
          </div>
        </div>

        {/* Floating Companion Preference */}
        <div className="preference-item">
          <div className="preference-info">
            <div className="preference-title-row">
              <Eye size={16} />
              <span className="pref-title">Show Desktop Companion (Pip)</span>
            </div>
            <p className="pref-desc">
              Display the cute animated desktop companion character. You can drag Pip anywhere on your screen.
            </p>
          </div>
          <div className="preference-control">
            <label className="switch">
              <input
                type="checkbox"
                checked={Boolean(settings.characterVisible)}
                onChange={() => handleToggle('characterVisible')}
              />
              <span className="slider round" />
            </label>
          </div>
        </div>

        {/* Windows Notifications Preference */}
        <div className="preference-item">
          <div className="preference-info">
            <div className="preference-title-row">
              <Bell size={16} />
              <span className="pref-title">Windows Native Notifications</span>
            </div>
            <p className="pref-desc">
              Receive native Windows banner alerts when a tracked repository falls behind its remote branch.
            </p>
          </div>
          <div className="preference-control">
            <label className="switch">
              <input
                type="checkbox"
                checked={Boolean(settings.notificationsEnabled)}
                onChange={() => handleToggle('notificationsEnabled')}
              />
              <span className="slider round" />
            </label>
          </div>
        </div>

        {/* Check Interval Preference */}
        <div className="preference-item">
          <div className="preference-info">
            <div className="preference-title-row">
              <Clock size={16} />
              <span className="pref-title">Background Check Frequency</span>
            </div>
            <p className="pref-desc">
              How often PullMate checks your remote repositories for incoming commits.
            </p>
          </div>
          <div className="preference-control">
            <select
              className="select-input"
              value={settings.checkIntervalMinutes || 0.5}
              onChange={(e) => handleChange('checkIntervalMinutes', Number(e.target.value))}
            >
              <option value={0.25}>Every 15 seconds (Ultra Real-Time)</option>
              <option value={0.5}>Every 30 seconds (Real-Time - Recommended)</option>
              <option value={1}>Every 1 minute (Fast Checks)</option>
              <option value={2}>Every 2 minutes</option>
              <option value={5}>Every 5 minutes</option>
              <option value={15}>Every 15 minutes</option>
              <option value={30}>Every 30 minutes</option>
              <option value={60}>Every 1 hour</option>
            </select>
          </div>
        </div>

        {/* Focus Auto-Check Preference */}
        <div className="preference-item">
          <div className="preference-info">
            <div className="preference-title-row">
              <Monitor size={16} />
              <span className="pref-title">Auto-Check on Window Focus</span>
            </div>
            <p className="pref-desc">
              Instantly check remote repositories for new collaborator commits whenever you switch back to PullMate.
            </p>
          </div>
          <div className="preference-control">
            <label className="switch">
              <input
                type="checkbox"
                checked={settings.autoCheckOnFocus !== false}
                onChange={() => handleToggle('autoCheckOnFocus')}
              />
              <span className="slider round" />
            </label>
          </div>
        </div>

        {/* Quiet Hours Preference */}
        <div className="preference-item">
          <div className="preference-info">
            <div className="preference-title-row">
              <Moon size={16} />
              <span className="pref-title">Quiet Hours</span>
            </div>
            <p className="pref-desc">
              Silence notifications during focus or sleeping hours. Pip will rest quietly during this time.
            </p>
          </div>
          <div className="preference-control quiet-hours-control">
            <label className="switch">
              <input
                type="checkbox"
                checked={Boolean(settings.quietHoursEnabled)}
                onChange={() => handleToggle('quietHoursEnabled')}
              />
              <span className="slider round" />
            </label>
            {settings.quietHoursEnabled && (
              <div className="quiet-time-pickers">
                <span>From</span>
                <input
                  type="time"
                  value={settings.quietHoursStart || '22:00'}
                  onChange={(e) => handleChange('quietHoursStart', e.target.value)}
                  className="time-picker"
                />
                <span>To</span>
                <input
                  type="time"
                  value={settings.quietHoursEnd || '08:00'}
                  onChange={(e) => handleChange('quietHoursEnd', e.target.value)}
                  className="time-picker"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {isWizard && (
        <div className="wizard-footer">
          <button className="btn-wizard-back" onClick={onBack}>
            Back
          </button>
          <button className="btn-wizard-next" onClick={onNext}>
            Continue to Completion
          </button>
        </div>
      )}
    </div>
  );
}
