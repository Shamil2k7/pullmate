import React, { useState, useEffect } from 'react';
import ReminderSettings from '../components/ReminderSettings';
import GithubIcon from '../components/GithubIcon';
import {
  Monitor,
  Eye,
  Bell,
  Clock,
  Terminal,
  RotateCcw,
  LogOut,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  ShieldCheck
} from 'lucide-react';

export default function Settings({ settings, onUpdateSettings, onResetSettings }) {
  const [gitStatus, setGitStatus] = useState(null);
  const [disconnecting, setDisconnecting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    if (window.pullmateApi?.system?.checkGitInstalled) {
      window.pullmateApi.system.checkGitInstalled().then(res => {
        setGitStatus(res);
      });
    }
  }, []);

  const handleDisconnectGitHub = async () => {
    if (!window.confirm('Disconnect your GitHub account and delete stored credentials?')) return;
    setDisconnecting(true);
    try {
      await window.pullmateApi?.auth?.disconnect();
      await onUpdateSettings({ userProfile: null });
    } catch (err) {
      console.error('Failed to disconnect GitHub:', err);
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSnooze = (hours) => {
    if (hours === 0) {
      window.pullmateApi?.system?.clearSnooze();
      onUpdateSettings({ snoozeUntil: null });
    } else {
      window.pullmateApi?.system?.snooze(hours);
      const until = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
      onUpdateSettings({ snoozeUntil: until });
    }
  };

  const handleResetPosition = () => {
    window.pullmateApi?.character?.savePosition(null, null);
    onUpdateSettings({ characterPosition: { x: null, y: null } });
    alert('Pip desktop position has been reset to default.');
  };

  const isSnoozed = settings.snoozeUntil && Date.now() < Date.parse(settings.snoozeUntil);

  return (
    <div className="settings-page-container">
      <div className="page-header-row">
        <div>
          <h2 className="page-heading">Application Settings</h2>
          <p className="page-subheading">
            Configure background synchronization, Pip desktop companion, and GitHub connection.
          </p>
        </div>
      </div>

      <div className="settings-sections-list">
        {/* GitHub Account Section */}
        <div className="settings-section-card">
          <h3 className="section-title">
            <GithubIcon size={18} />
            <span>GitHub Connection</span>
          </h3>

          {settings.userProfile ? (
            <div className="github-account-info-box">
              <div className="account-details-row">
                {settings.userProfile.avatar_url && (
                  <img
                    src={settings.userProfile.avatar_url}
                    alt={settings.userProfile.login}
                    className="account-avatar-large"
                  />
                )}
                <div>
                  <h4 className="account-name">{settings.userProfile.name || settings.userProfile.login}</h4>
                  <p className="account-login">@{settings.userProfile.login}</p>
                  <div className="account-meta-tags">
                    <span className="tag-connected">
                      <CheckCircle2 size={12} /> Connected & Secured
                    </span>
                    {settings.userProfile.public_repos !== undefined && (
                      <span className="tag-stat">
                        {settings.userProfile.public_repos} public repos
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="account-actions-row">
                <button
                  className="btn-disconnect-danger"
                  onClick={handleDisconnectGitHub}
                  disabled={disconnecting}
                >
                  <LogOut size={14} />
                  <span>{disconnecting ? 'Disconnecting...' : 'Disconnect Account & Erase Token'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="github-disconnected-box">
              <p>No GitHub account connected. PullMate can still monitor any local Git repositories on your computer.</p>
              <button
                className="btn-connect-account"
                onClick={() => onUpdateSettings({ onboardingCompleted: false })}
              >
                <GithubIcon size={15} />
                <span>Run Connection Wizard</span>
              </button>
            </div>
          )}
        </div>

        {/* Desktop Companion (Pip) Controls */}
        <div className="settings-section-card">
          <h3 className="section-title">
            <Eye size={18} />
            <span>Desktop Companion (Pip)</span>
          </h3>

          <div className="preferences-grid">
            <div className="preference-item">
              <div className="preference-info">
                <span className="pref-title">Always on Top</span>
                <p className="pref-desc">
                  Keep Pip floating above other desktop windows so you never miss an alert.
                </p>
              </div>
              <div className="preference-control">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={Boolean(settings.characterAlwaysOnTop)}
                    onChange={() => onUpdateSettings({ characterAlwaysOnTop: !settings.characterAlwaysOnTop })}
                  />
                  <span className="slider round" />
                </label>
              </div>
            </div>

            <div className="preference-item">
              <div className="preference-info">
                <span className="pref-title">Minimize to Tray</span>
                <p className="pref-desc">
                  Closing the main window will minimize PullMate to the system tray instead of exiting.
                </p>
              </div>
              <div className="preference-control">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={Boolean(settings.minimizeToTray)}
                    onChange={() => onUpdateSettings({ minimizeToTray: !settings.minimizeToTray })}
                  />
                  <span className="slider round" />
                </label>
              </div>
            </div>

            <div className="preference-item">
              <div className="preference-info">
                <span className="pref-title">Reset Companion Position</span>
                <p className="pref-desc">
                  Moved Pip off-screen or changed monitors? Snap Pip back to the bottom-right corner.
                </p>
              </div>
              <div className="preference-control">
                <button className="btn-secondary-action" onClick={handleResetPosition}>
                  <RotateCcw size={14} />
                  <span>Reset Position</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Snooze & Quiet Hours */}
        <div className="settings-section-card">
          <h3 className="section-title">
            <Clock size={18} />
            <span>Snooze Reminders</span>
          </h3>

          <div className="snooze-controls-box">
            <p className="snooze-status-text">
              {isSnoozed ? (
                <span className="text-attention">
                  Reminders are currently snoozed until {new Date(settings.snoozeUntil).toLocaleTimeString()}.
                </span>
              ) : (
                <span>Reminders are active. Choose a snooze duration if you need quiet focus time:</span>
              )}
            </p>

            <div className="snooze-buttons-row">
              <button className="btn-snooze" onClick={() => handleSnooze(1)}>
                Snooze 1 Hour
              </button>
              <button className="btn-snooze" onClick={() => handleSnooze(2)}>
                Snooze 2 Hours
              </button>
              <button className="btn-snooze" onClick={() => handleSnooze(4)}>
                Snooze 4 Hours
              </button>
              {isSnoozed && (
                <button className="btn-snooze btn-snooze-clear" onClick={() => handleSnooze(0)}>
                  Clear Snooze
                </button>
              )}
            </div>
          </div>
        </div>

        {/* General Synchronization Preferences */}
        <div className="settings-section-card">
          <h3 className="section-title">
            <Bell size={18} />
            <span>Sync & Notifications</span>
          </h3>
          <ReminderSettings
            settings={settings}
            onUpdateSettings={onUpdateSettings}
            isWizard={false}
          />
        </div>

        {/* System & Diagnostics */}
        <div className="settings-section-card">
          <h3 className="section-title">
            <Terminal size={18} />
            <span>Environment Diagnostics</span>
          </h3>

          <div className="diagnostics-list">
            <div className="diagnostic-item">
              <span className="diag-label">Git CLI Status:</span>
              <span className="diag-value">
                {gitStatus?.installed ? (
                  <span className="text-success">✓ {gitStatus.version}</span>
                ) : (
                  <span className="text-danger">✗ Git not detected in PATH</span>
                )}
              </span>
            </div>

            <div className="diagnostic-item">
              <span className="diag-label">Application:</span>
              <span className="diag-value">PullMate Desktop v1.0.0 (Windows x64)</span>
            </div>

            <div className="diagnostic-item">
              <span className="diag-label">Credential Security:</span>
              <span className="diag-value text-success">
                <ShieldCheck size={14} className="inline-icon" /> Windows DPAPI SafeStorage Active
              </span>
            </div>
          </div>

          <div className="reset-section-row">
            <button
              className="btn-danger-outline"
              onClick={() => setShowResetConfirm(true)}
            >
              <RotateCcw size={14} />
              <span>Reset Application to Defaults</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div className="card-modal-backdrop">
          <div className="card-modal">
            <h4 className="modal-title">Reset Settings?</h4>
            <p className="modal-text">
              This will restore all preferences and check intervals to default settings.
            </p>
            <div className="modal-actions">
              <button className="btn-modal btn-cancel" onClick={() => setShowResetConfirm(false)}>
                Cancel
              </button>
              <button
                className="btn-modal btn-danger"
                onClick={() => {
                  onResetSettings(false);
                  setShowResetConfirm(false);
                }}
              >
                Reset Defaults
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
