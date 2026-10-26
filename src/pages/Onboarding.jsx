import React, { useState, useEffect } from 'react';
import RepositoryPicker from '../components/RepositoryPicker';
import CloneDialog from '../components/CloneDialog';
import ReminderSettings from '../components/ReminderSettings';
import GithubIcon from '../components/GithubIcon';
import {
  Key,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  AlertCircle,
  Copy,
  ChevronRight,
  ArrowRight
} from 'lucide-react';

export default function Onboarding({ settings, onUpdateSettings, onFinishOnboarding }) {
  const [step, setStep] = useState(1); // 1: Welcome, 2: Connect GitHub, 3: Select Repos, 4: Clone/Link, 5: Preferences, 6: Complete
  const [selectedRepos, setSelectedRepos] = useState([]);
  
  // GitHub Auth State
  const [authLoading, setAuthLoading] = useState(false);
  const [deviceCodeData, setDeviceCodeData] = useState(null);
  const [authStatus, setAuthStatus] = useState(null); // 'idle' | 'pending' | 'complete' | 'error'
  const [authError, setAuthError] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [customClientId, setCustomClientId] = useState('');
  const [showAdvancedAuth, setShowAdvancedAuth] = useState(false);

  useEffect(() => {
    // Check if already authenticated
    if (settings?.userProfile) {
      setAuthStatus('complete');
    }
    // Load custom client id if configured
    if (window.pullmateApi?.auth?.getClientId) {
      window.pullmateApi.auth.getClientId().then((id) => {
        if (id) setCustomClientId(id);
      });
    }
  }, [settings]);

  // Subscribe to auth progress
  useEffect(() => {
    if (window.pullmateApi?.auth?.onAuthProgress) {
      const unsubscribe = window.pullmateApi.auth.onAuthProgress((progress) => {
        if (progress.status === 'checking') {
          // Still waiting for approval
        } else if (progress.status === 'complete') {
          setAuthStatus('complete');
          setAuthLoading(false);
        } else if (progress.status === 'error') {
          setAuthError(progress.error);
          setAuthLoading(false);
        }
      });
      return () => unsubscribe();
    }
  }, []);

  const handleStartDeviceAuth = async () => {
    setAuthLoading(true);
    setAuthError(null);
    try {
      if (customClientId) {
        await window.pullmateApi?.auth?.setClientId(customClientId);
      }
      const res = await window.pullmateApi?.auth?.startDeviceAuth();
      if (!res.success) {
        throw new Error(res.error || 'Failed to start GitHub authorization');
      }
      setDeviceCodeData(res);
      setAuthStatus('pending');
    } catch (err) {
      setAuthError(err.message);
      setAuthLoading(false);
    }
  };

  const handleCopyCode = () => {
    if (deviceCodeData?.user_code) {
      navigator.clipboard.writeText(deviceCodeData.user_code);
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    }
  };

  const handleOpenGitHubVerification = () => {
    if (deviceCodeData?.verification_uri) {
      window.pullmateApi?.repositories?.openExternal(deviceCodeData.verification_uri);
    }
  };

  const handleFinish = async () => {
    await onUpdateSettings({ onboardingCompleted: true });
    onFinishOnboarding();
  };

  return (
    <div className="onboarding-page-layout">
      {/* Step Progress Header */}
      <div className="onboarding-progress-bar">
        {[1, 2, 3, 4, 5, 6].map((num) => (
          <div
            key={num}
            className={`progress-step-pill ${step === num ? 'active' : step > num ? 'completed' : ''}`}
          >
            <span className="step-num">{num}</span>
          </div>
        ))}
      </div>

      <div className="onboarding-content-card">
        {/* ================= SCREEN 1: WELCOME ================= */}
        {step === 1 && (
          <div className="wizard-step-welcome">
            <div className="welcome-mascot-preview">
              <svg viewBox="0 0 140 140" width="120" height="120" className="welcome-pip-svg">
                <rect x="30" y="32" width="80" height="88" rx="38" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="2.5" />
                <rect x="42" y="48" width="56" height="40" rx="16" fill="#1E293B" stroke="#334155" strokeWidth="1.5" />
                <circle cx="55" cy="68" r="4.5" fill="#2DD4BF" />
                <circle cx="85" cy="68" r="4.5" fill="#2DD4BF" />
                <path d="M 66 79 Q 70 82 74 79" stroke="#2DD4BF" strokeWidth="1.5" strokeLinecap="round" fill="none" />
                <circle cx="70" cy="16" r="7" fill="#10B981" />
                <line x1="70" y1="36" x2="70" y2="20" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>

            <div className="welcome-brand-badge">PullMate</div>
            <h1 className="welcome-hero-heading">Your little Git buddy is here.</h1>
            <p className="welcome-hero-subtext">
              PullMate lives on your desktop to make sure you never code on outdated branches or lose synchronization with your team.
            </p>

            <div className="welcome-features-list">
              <div className="feature-bullet">
                <CheckCircle2 size={16} className="text-accent" />
                <span>Checks your repositories automatically in the background</span>
              </div>
              <div className="feature-bullet">
                <CheckCircle2 size={16} className="text-accent" />
                <span>Safely notifies you with non-intrusive desktop updates</span>
              </div>
              <div className="feature-bullet">
                <CheckCircle2 size={16} className="text-accent" />
                <span>Fast-forward one-click synchronization with zero hassle</span>
              </div>
            </div>

            <button className="btn-welcome-primary" onClick={() => setStep(2)}>
              <span>Get Started</span>
              <ArrowRight size={18} />
            </button>
          </div>
        )}

        {/* ================= SCREEN 2: CONNECT GITHUB ================= */}
        {step === 2 && (
          <div className="wizard-step-container">
            <div className="wizard-step-header">
              <h2 className="step-title">Connect Your GitHub Account</h2>
              <p className="step-description">
                Authorize PullMate securely via GitHub's official Device Authorization Flow.
                We never see or store your GitHub password.
              </p>
            </div>

            <div className="auth-card-body">
              {authStatus === 'complete' || settings?.userProfile ? (
                <div className="auth-success-card">
                  <CheckCircle2 size={42} className="text-success" />
                  <h3>GitHub Connected!</h3>
                  <p>
                    Authenticated as <strong>{settings?.userProfile?.login || 'GitHub User'}</strong>.
                  </p>
                  <button className="btn-auth-continue" onClick={() => setStep(3)}>
                    <span>Continue to Select Repositories</span>
                    <ChevronRight size={16} />
                  </button>
                </div>
              ) : authStatus === 'pending' && deviceCodeData ? (
                <div className="device-flow-card">
                  <p className="device-flow-instruction">
                    1. Copy your single-use one-time code:
                  </p>
                  <div className="device-code-box">
                    <span className="device-code-string">{deviceCodeData.user_code}</span>
                    <button className="btn-copy-code" onClick={handleCopyCode}>
                      {copiedCode ? <CheckCircle2 size={16} className="text-success" /> : <Copy size={16} />}
                      <span>{copiedCode ? 'Copied!' : 'Copy Code'}</span>
                    </button>
                  </div>

                  <p className="device-flow-instruction">
                    2. Click below to verify in your default browser:
                  </p>
                  <button className="btn-open-verify" onClick={handleOpenGitHubVerification}>
                    <ExternalLink size={16} />
                    <span>Open GitHub Verification Page</span>
                  </button>

                  <div className="polling-status-indicator">
                    <RefreshCw size={15} className="spinning text-accent" />
                    <span>Waiting for your authorization on GitHub...</span>
                  </div>
                </div>
              ) : (
                <div className="auth-initial-card">
                  <div className="security-guarantee-box">
                    <ShieldCheck size={20} className="text-accent" />
                    <div>
                      <strong>Safe & Read-Only Access</strong>
                      <p>
                        PullMate only requests access to list and fetch repository status.
                        Credentials are encrypted natively using Windows DPAPI.
                      </p>
                    </div>
                  </div>

                  {authError && (
                    <div className="dialog-error-box">
                      <AlertCircle size={16} />
                      <span>{authError}</span>
                    </div>
                  )}

                  <div className="auth-actions-row">
                    <button
                      className="btn-github-authorize"
                      onClick={handleStartDeviceAuth}
                      disabled={authLoading}
                    >
                      <GithubIcon size={18} />
                      <span>{authLoading ? 'Connecting...' : 'Authorize with GitHub'}</span>
                    </button>
                  </div>

                  {/* Optional Custom Client ID Expandable */}
                  <div className="advanced-auth-section">
                    <button
                      className="btn-text-link"
                      onClick={() => setShowAdvancedAuth(!showAdvancedAuth)}
                    >
                      {showAdvancedAuth ? 'Hide advanced OAuth options' : 'Need to specify a custom GitHub OAuth Client ID?'}
                    </button>

                    {showAdvancedAuth && (
                      <div className="advanced-client-id-form">
                        <label className="input-label">GitHub OAuth Client ID (from Developer Settings)</label>
                        <input
                          type="text"
                          placeholder="e.g. Ov23li..."
                          value={customClientId}
                          onChange={(e) => setCustomClientId(e.target.value)}
                          className="text-input"
                        />
                        <p className="input-hint">
                          If configured in your <code>.env</code> file, this is loaded automatically.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="wizard-footer">
              <button className="btn-wizard-back" onClick={() => setStep(1)}>
                Back
              </button>
              {/* Allow skipping GitHub connect if user just wants to track local repos */}
              <button className="btn-skip-repo" onClick={() => setStep(4)}>
                Skip for now (configure local repos directly)
              </button>
            </div>
          </div>
        )}

        {/* ================= SCREEN 3: SELECT REPOSITORIES ================= */}
        {step === 3 && (
          <RepositoryPicker
            selectedRepos={selectedRepos}
            onSelectionChange={setSelectedRepos}
            onNext={() => setStep(4)}
            onBack={() => setStep(2)}
          />
        )}

        {/* ================= SCREEN 4: CLONE OR LINK ================= */}
        {step === 4 && (
          <CloneDialog
            selectedRepos={selectedRepos}
            onSetupComplete={() => setStep(5)}
            onBack={() => setStep(selectedRepos.length > 0 ? 3 : 2)}
          />
        )}

        {/* ================= SCREEN 5: REMINDER PREFERENCES ================= */}
        {step === 5 && (
          <ReminderSettings
            settings={settings}
            onUpdateSettings={onUpdateSettings}
            isWizard={true}
            onNext={() => setStep(6)}
            onBack={() => setStep(4)}
          />
        )}

        {/* ================= SCREEN 6: SETUP COMPLETE ================= */}
        {step === 6 && (
          <div className="wizard-step-complete">
            <div className="complete-mascot-celebration">
              <span className="celebration-badge">🎉</span>
              <svg viewBox="0 0 140 140" width="130" height="130" className="complete-pip-svg">
                <rect x="30" y="32" width="80" height="88" rx="38" fill="#FFFFFF" stroke="#94A3B8" strokeWidth="2.5" />
                <rect x="42" y="48" width="56" height="40" rx="16" fill="#1E293B" stroke="#334155" strokeWidth="1.5" />
                <path d="M 50 70 Q 55 64 60 70" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <path d="M 80 70 Q 85 64 90 70" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                <circle cx="48" cy="74" r="3" fill="#F472B6" opacity="0.6" />
                <circle cx="92" cy="74" r="3" fill="#F472B6" opacity="0.6" />
                <path d="M 64 78 Q 70 84 76 78" stroke="#34D399" strokeWidth="2" strokeLinecap="round" fill="none" />
                <circle cx="70" cy="16" r="7" fill="#A855F7" />
                <line x1="70" y1="36" x2="70" y2="20" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
              </svg>
            </div>

            <h2 className="complete-title">All set! I'll keep an eye on your repositories.</h2>
            <p className="complete-subtext">
              PullMate is configured and ready to work in the background. Pip will quietly watch your tracked repositories and notify you whenever you need to synchronize.
            </p>

            <div className="complete-actions-group">
              <button className="btn-finish-primary" onClick={handleFinish}>
                <span>Finish Setup & Open Dashboard</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
