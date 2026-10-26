import React from 'react';
import { RefreshCw, Plus, Search, Bell, BellOff } from 'lucide-react';
import GithubIcon from './GithubIcon';

export default function Topbar({
  pipGreeting,
  userProfile,
  searchQuery,
  onSearchChange,
  onCheckAll,
  isCheckingAll,
  onAddRepoClick,
  notificationsEnabled,
  isSnoozed
}) {
  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <div className="pip-topbar-greeting">
          <span className="pip-avatar-emoji">🌱</span>
          <div className="greeting-text-box">
            <span className="pip-bubble-saying">{pipGreeting || "Hey there! Ready to keep your Git repositories synchronized?"}</span>
          </div>
        </div>
      </div>

      <div className="topbar-center">
        <div className="topbar-search-box">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            placeholder="Search tracked repositories..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <div className="topbar-right">
        {/* Notification Status Pill */}
        <div
          className={`topbar-status-pill ${isSnoozed ? 'snoozed' : notificationsEnabled ? 'enabled' : 'disabled'}`}
          title={isSnoozed ? 'Notifications Snoozed' : notificationsEnabled ? 'Notifications Active' : 'Notifications Off'}
        >
          {notificationsEnabled && !isSnoozed ? (
            <Bell size={13} className="pill-icon" />
          ) : (
            <BellOff size={13} className="pill-icon" />
          )}
          <span>{isSnoozed ? 'Snoozed' : notificationsEnabled ? 'Alerts On' : 'Alerts Off'}</span>
        </div>

        {/* Check All Button */}
        <button
          className="btn-topbar btn-refresh"
          onClick={onCheckAll}
          disabled={isCheckingAll}
          title="Fetch and check all repositories"
        >
          <RefreshCw size={14} className={isCheckingAll ? 'spinning' : ''} />
          <span>{isCheckingAll ? 'Checking...' : 'Check All'}</span>
        </button>

        {/* Add Repository Button */}
        <button
          className="btn-topbar btn-add-repo"
          onClick={onAddRepoClick}
        >
          <Plus size={15} />
          <span>Add Repository</span>
        </button>

        {/* User Profile Badge */}
        {userProfile ? (
          <div className="topbar-user-badge" title={`Signed in as ${userProfile.login}`}>
            {userProfile.avatar_url ? (
              <img src={userProfile.avatar_url} alt={userProfile.login} className="user-avatar-img" />
            ) : (
              <GithubIcon size={18} />
            )}
            <span className="user-login-name">{userProfile.login}</span>
          </div>
        ) : (
          <div className="topbar-user-badge disconnected" title="GitHub Not Connected">
            <GithubIcon size={16} />
            <span>Not Connected</span>
          </div>
        )}
      </div>
    </header>
  );
}
