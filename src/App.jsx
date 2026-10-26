import React, { useState, useEffect } from 'react';
import { useSettings } from './hooks/useSettings';
import { useRepositories } from './hooks/useRepositories';
import FloatingCharacter from './components/FloatingCharacter';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import Repositories from './pages/Repositories';
import Activity from './pages/Activity';
import Settings from './pages/Settings';

export default function App() {
  // Check if running in floating character window mode
  const isCharacterMode = window.location.search.includes('mode=character');

  const { settings, loading: settingsLoading, updateSettings, resetSettings } = useSettings();
  const {
    repositories,
    loading: reposLoading,
    isCheckingAll,
    actionInProgressId,
    checkAll,
    checkStatus,
    pullRepository,
    removeRepository,
    addRepository,
    openFolder,
    openExternal
  } = useRepositories();

  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [pipGreeting, setPipGreeting] = useState('');

  // If this window is the floating character window, render the companion directly
  if (isCharacterMode) {
    return <FloatingCharacter />;
  }

  // Handle IPC navigation events (e.g. from tray menu)
  useEffect(() => {
    // Listen for custom navigation event if passed from main process
    const handleMessage = (e) => {
      if (e.data?.type === 'navigate-to') {
        setActiveTab(e.data.tab || 'settings');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Update Pip greeting dynamically based on repository status
  useEffect(() => {
    if (repositories.length === 0) {
      setPipGreeting('Welcome to PullMate! Track a repository to keep it synchronized.');
      return;
    }

    const behindList = repositories.filter(r => r.status === 'behind' || r.behindCount > 0);
    const uncommittedList = repositories.filter(r => !r.isClean);

    if (behindList.length > 0) {
      setPipGreeting(
        behindList.length === 1
          ? `${behindList[0].name} has incoming commits waiting for you!`
          : `${behindList.length} repositories are behind remote branches.`
      );
    } else if (uncommittedList.length > 0) {
      setPipGreeting('You have uncommitted local changes. Remember to commit your work!');
    } else {
      setPipGreeting('All your repositories are synchronized and up to date! Great work!');
    }
  }, [repositories]);

  if (settingsLoading) {
    return (
      <div className="app-loading-screen">
        <div className="loading-spinner" />
        <p>Starting PullMate...</p>
      </div>
    );
  }

  // Show Onboarding if not completed yet
  if (!settings.onboardingCompleted) {
    return (
      <Onboarding
        settings={settings}
        onUpdateSettings={updateSettings}
        onFinishOnboarding={() => setActiveTab('overview')}
      />
    );
  }

  const isSnoozed = Boolean(settings.snoozeUntil && Date.now() < Date.parse(settings.snoozeUntil));

  return (
    <div className="app-root-layout">
      <Sidebar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        settings={settings}
        onUpdateSettings={updateSettings}
        trackedCount={repositories.length}
      />

      <div className="app-main-viewport">
        <Topbar
          pipGreeting={pipGreeting}
          userProfile={settings.userProfile}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onCheckAll={checkAll}
          isCheckingAll={isCheckingAll}
          onAddRepoClick={() => setActiveTab('overview')}
          notificationsEnabled={settings.notificationsEnabled}
          isSnoozed={isSnoozed}
        />

        <main className="app-content-scroll">
          {activeTab === 'overview' && (
            <Dashboard
              repositories={repositories}
              settings={settings}
              onCheckAll={checkAll}
              isCheckingAll={isCheckingAll}
              onCheckStatus={checkStatus}
              onPull={pullRepository}
              onRemove={removeRepository}
              onOpenFolder={openFolder}
              onOpenExternal={openExternal}
              onAddRepository={addRepository}
              actionInProgressId={actionInProgressId}
              searchQuery={searchQuery}
            />
          )}

          {activeTab === 'repositories' && (
            <Repositories
              repositories={repositories}
              onCheckStatus={checkStatus}
              onPull={pullRepository}
              onRemove={removeRepository}
              onOpenFolder={openFolder}
              onOpenExternal={openExternal}
              actionInProgressId={actionInProgressId}
              searchQuery={searchQuery}
            />
          )}

          {activeTab === 'activity' && (
            <Activity
              repositories={repositories}
              settings={settings}
              onCheckAll={checkAll}
              isCheckingAll={isCheckingAll}
            />
          )}

          {(activeTab === 'reminders' || activeTab === 'settings' || activeTab === 'account') && (
            <Settings
              settings={settings}
              onUpdateSettings={updateSettings}
              onResetSettings={resetSettings}
            />
          )}
        </main>
      </div>
    </div>
  );
}
