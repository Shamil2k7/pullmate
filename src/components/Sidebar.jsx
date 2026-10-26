import React from 'react';
import {
  LayoutDashboard,
  FolderGit2,
  Activity,
  Bell,
  Settings,
  User,
  Eye,
  EyeOff,
  Minus,
  Maximize2
} from 'lucide-react';

export default function Sidebar({ activeTab, onTabChange, settings, onUpdateSettings, trackedCount = 0 }) {
  const toggleCharacter = () => {
    onUpdateSettings({ characterVisible: !settings.characterVisible });
  };

  const toggleMinimize = () => {
    onUpdateSettings({ characterMinimized: !settings.characterMinimized });
  };

  return (
    <aside className="app-sidebar">
      <div className="sidebar-brand">
        <div className="brand-logo-badge">
          <svg viewBox="0 0 32 32" width="24" height="24" fill="none">
            <circle cx="16" cy="16" r="14" fill="#2E7D32" />
            <circle cx="12" cy="13" r="2.5" fill="#FFFFFF" />
            <circle cx="20" cy="13" r="2.5" fill="#FFFFFF" />
            <path d="M11 20 C13 23, 19 23, 21 20" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
          </svg>
        </div>
        <div className="brand-text">
          <span className="brand-name">PullMate</span>
          <span className="brand-tagline">Git Companion</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        <button
          className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
          onClick={() => onTabChange('overview')}
        >
          <LayoutDashboard size={18} />
          <span>Overview</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'repositories' ? 'active' : ''}`}
          onClick={() => onTabChange('repositories')}
        >
          <FolderGit2 size={18} />
          <span>Repositories</span>
          {trackedCount > 0 && <span className="nav-counter">{trackedCount}</span>}
        </button>

        <button
          className={`nav-item ${activeTab === 'activity' ? 'active' : ''}`}
          onClick={() => onTabChange('activity')}
        >
          <Activity size={18} />
          <span>Activity</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'reminders' ? 'active' : ''}`}
          onClick={() => onTabChange('reminders')}
        >
          <Bell size={18} />
          <span>Reminders</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`}
          onClick={() => onTabChange('settings')}
        >
          <Settings size={18} />
          <span>Settings</span>
        </button>

        <button
          className={`nav-item ${activeTab === 'account' ? 'active' : ''}`}
          onClick={() => onTabChange('account')}
        >
          <User size={18} />
          <span>GitHub Account</span>
        </button>
      </nav>

      {/* Pip Companion Mini-Card in Sidebar */}
      <div className="sidebar-pip-card">
        <div className="pip-card-header">
          <div className={`pip-status-dot ${settings.characterVisible ? 'active' : ''}`} />
          <span className="pip-card-title">Pip Companion</span>
        </div>
        <p className="pip-card-desc">
          {!settings.characterVisible
            ? 'Pip is currently hidden.'
            : settings.characterMinimized
            ? 'Pip is minimized in the bottom-left corner.'
            : 'Pip is floating on your desktop.'}
        </p>
        <div className="pip-card-actions">
          <button
            className={`btn-toggle-pip ${settings.characterVisible ? 'visible' : 'hidden'}`}
            onClick={toggleCharacter}
          >
            {settings.characterVisible ? (
              <>
                <EyeOff size={14} />
                <span>Hide</span>
              </>
            ) : (
              <>
                <Eye size={14} />
                <span>Show Pip</span>
              </>
            )}
          </button>
          {settings.characterVisible && (
            <button
              className="btn-minimize-pip"
              onClick={toggleMinimize}
              title={settings.characterMinimized ? 'Restore Pip to normal size' : 'Minimize Pip to bottom-left'}
            >
              {settings.characterMinimized ? (
                <>
                  <Maximize2 size={13} />
                  <span>Restore</span>
                </>
              ) : (
                <>
                  <Minus size={13} />
                  <span>Minimize</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
