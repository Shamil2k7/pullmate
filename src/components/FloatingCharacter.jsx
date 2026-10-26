import React, { useState, useEffect } from 'react';
import CharacterBubble from './CharacterBubble';
import { RefreshCw } from 'lucide-react';

export default function FloatingCharacter() {
  const [pipState, setPipState] = useState({
    state: 'idle', // idle, greeting, checking, updates_available, up_to_date, unsaved_changes, error, sleeping, celebrating
    message: 'Hello! I am Pip, your Git companion.',
    action: null
  });
  const [showBubble, setShowBubble] = useState(true);

  useEffect(() => {
    // Initial state fetch
    if (window.pullmateApi?.character?.getState) {
      window.pullmateApi.character.getState().then((st) => {
        if (st) setPipState(st);
      });
    }

    // Subscribe to state updates from main process
    if (window.pullmateApi?.character?.onStateChanged) {
      const unsubscribe = window.pullmateApi.character.onStateChanged((newState) => {
        setPipState(newState);
        setShowBubble(true);
      });
      return () => unsubscribe();
    }
  }, []);

  const handleHideCharacter = () => {
    window.pullmateApi?.character?.hide();
  };

  const handleOpenMainWindow = () => {
    window.pullmateApi?.character?.openMainWindow();
  };

  const handleCheckAll = async () => {
    if (window.pullmateApi?.repositories?.checkAll) {
      setPipState(prev => ({
        ...prev,
        state: 'checking',
        message: 'Checking all repositories...'
      }));
      await window.pullmateApi.repositories.checkAll();
    }
  };

  const { state } = pipState;

  // Compute antenna glow color based on state
  const getOrbColor = () => {
    switch (state) {
      case 'up_to_date':
        return '#10B981'; // emerald
      case 'updates_available':
        return '#F59E0B'; // amber
      case 'checking':
        return '#3B82F6'; // blue
      case 'celebrating':
        return '#A855F7'; // purple
      case 'sleeping':
        return '#64748B'; // slate
      case 'unsaved_changes':
        return '#FB923C'; // orange
      case 'error':
        return '#EF4444'; // red
      default:
        return '#10B981'; // green idle
    }
  };

  return (
    <div className="floating-companion-wrapper">
      {/* Speech Bubble */}
      {showBubble && (
        <CharacterBubble
          message={pipState.message}
          action={pipState.action}
          onClose={() => setShowBubble(false)}
          onHideCharacter={handleHideCharacter}
          onOpenMainWindow={handleOpenMainWindow}
        />
      )}

      {/* Pip Mascot SVG & Controls */}
      <div className="pip-character-container drag-handle" title="Pip: Drag to move, double-click to open PullMate" onDoubleClick={handleOpenMainWindow}>
        <div className={`pip-mascot-body state-${state}`}>
          {/* Confetti elements for celebrating state */}
          {state === 'celebrating' && (
            <div className="confetti-container">
              <span className="confetti c1">✦</span>
              <span className="confetti c2">★</span>
              <span className="confetti c3">✦</span>
              <span className="confetti c4">★</span>
            </div>
          )}

          {/* Sleeping zZz for sleeping state */}
          {state === 'sleeping' && (
            <div className="sleeping-container">
              <span className="sleep-z z1">z</span>
              <span className="sleep-z z2">Z</span>
              <span className="sleep-z z3">Z</span>
            </div>
          )}

          <svg viewBox="0 0 140 140" width="130" height="130" className="pip-svg">
            <defs>
              <linearGradient id="pipBodyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="100%" stopColor="#E2E8F0" />
              </linearGradient>
              <linearGradient id="pipVisorGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#1E293B" />
                <stop offset="100%" stopColor="#0F172A" />
              </linearGradient>
              <filter id="orbGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Ground Shadow */}
            <ellipse cx="70" cy="132" rx="36" ry="6" fill="rgba(15, 23, 42, 0.14)" className="pip-shadow" />

            {/* Left Hand / Arm */}
            <g className={`pip-arm pip-arm-left ${state === 'greeting' ? 'arm-wave' : ''} ${state === 'celebrating' ? 'arm-up' : ''}`}>
              <rect x="18" y="74" width="16" height="12" rx="6" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="1.5" />
            </g>

            {/* Right Hand / Arm */}
            <g className={`pip-arm pip-arm-right ${state === 'celebrating' ? 'arm-up' : ''}`}>
              <rect x="106" y="74" width="16" height="12" rx="6" fill="#CBD5E1" stroke="#94A3B8" strokeWidth="1.5" />
            </g>

            {/* Antenna Stem */}
            <line x1="70" y1="36" x2="70" y2="20" stroke="#94A3B8" strokeWidth="3" strokeLinecap="round" />
            {/* Antenna Glowing Orb */}
            <circle
              cx="70"
              cy="16"
              r="7"
              fill={getOrbColor()}
              filter="url(#orbGlow)"
              className="pip-antenna-orb"
            />
            <circle cx="68" cy="14" r="2" fill="#FFFFFF" opacity="0.8" />

            {/* Main Rounded Robot Body */}
            <rect
              x="30"
              y="32"
              width="80"
              height="88"
              rx="38"
              fill="url(#pipBodyGrad)"
              stroke="#94A3B8"
              strokeWidth="2.5"
              className="pip-torso"
            />

            {/* Dark Visor / Screen Face */}
            <rect
              x="42"
              y="48"
              width="56"
              height="40"
              rx="16"
              fill="url(#pipVisorGrad)"
              stroke="#334155"
              strokeWidth="1.5"
              className="pip-visor"
            />

            {/* Face Expressions based on state */}
            {state === 'sleeping' ? (
              // Sleeping eyes: downward gentle curved arcs
              <g className="pip-eyes-sleeping" stroke="#60A5FA" strokeWidth="2.5" strokeLinecap="round" fill="none">
                <path d="M 50 68 Q 55 72 60 68" />
                <path d="M 80 68 Q 85 72 90 68" />
              </g>
            ) : state === 'up_to_date' || state === 'celebrating' ? (
              // Joyful / happy smiling eyes: upward curved arcs
              <g className="pip-eyes-happy" stroke="#34D399" strokeWidth="2.5" strokeLinecap="round" fill="none">
                <path d="M 50 70 Q 55 64 60 70" />
                <path d="M 80 70 Q 85 64 90 70" />
                {/* Cheerful blush */}
                <circle cx="48" cy="74" r="3" fill="#F472B6" opacity="0.6" stroke="none" />
                <circle cx="92" cy="74" r="3" fill="#F472B6" opacity="0.6" stroke="none" />
              </g>
            ) : state === 'error' ? (
              // Error eyes: cross/dizzy
              <g className="pip-eyes-error" stroke="#F87171" strokeWidth="2" strokeLinecap="round">
                <line x1="51" y1="64" x2="59" y2="72" />
                <line x1="59" y1="64" x2="51" y2="72" />
                <line x1="81" y1="64" x2="89" y2="72" />
                <line x1="89" y1="64" x2="81" y2="72" />
              </g>
            ) : state === 'updates_available' ? (
              // Alert eyes with amber ping
              <g className="pip-eyes-alert">
                <circle cx="55" cy="68" r="5" fill="#FBBF24" />
                <circle cx="85" cy="68" r="5" fill="#FBBF24" />
                <circle cx="56" cy="66" r="1.5" fill="#FFFFFF" />
                <circle cx="86" cy="66" r="1.5" fill="#FFFFFF" />
              </g>
            ) : state === 'checking' ? (
              // Checking / scanning eyes
              <g className="pip-eyes-checking">
                <circle cx="55" cy="68" r="4.5" fill="#60A5FA" className="scan-eye-left" />
                <circle cx="85" cy="68" r="4.5" fill="#60A5FA" className="scan-eye-right" />
                <circle cx="56" cy="66.5" r="1.2" fill="#FFFFFF" />
                <circle cx="86" cy="66.5" r="1.2" fill="#FFFFFF" />
              </g>
            ) : (
              // Default / Idle / Greeting eyes with blinking animation
              <g className="pip-eyes-normal">
                <g className="pip-eye pip-eye-left">
                  <circle cx="55" cy="68" r="4.5" fill="#2DD4BF" />
                  <circle cx="56.5" cy="66.5" r="1.5" fill="#FFFFFF" />
                </g>
                <g className="pip-eye pip-eye-right">
                  <circle cx="85" cy="68" r="4.5" fill="#2DD4BF" />
                  <circle cx="86.5" cy="66.5" r="1.5" fill="#FFFFFF" />
                </g>
                {state === 'greeting' && (
                  <>
                    <circle cx="48" cy="74" r="3" fill="#F472B6" opacity="0.6" />
                    <circle cx="92" cy="74" r="3" fill="#F472B6" opacity="0.6" />
                  </>
                )}
              </g>
            )}

            {/* Mouth */}
            {state === 'celebrating' || state === 'up_to_date' ? (
              <path d="M 64 78 Q 70 84 76 78" stroke="#34D399" strokeWidth="2" strokeLinecap="round" fill="none" />
            ) : state === 'updates_available' ? (
              <circle cx="70" cy="80" r="2" fill="#FBBF24" />
            ) : state === 'error' ? (
              <path d="M 65 81 Q 70 77 75 81" stroke="#F87171" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            ) : state === 'sleeping' ? (
              <path d="M 67 79 L 73 79" stroke="#60A5FA" strokeWidth="1.5" strokeLinecap="round" />
            ) : (
              <path d="M 66 79 Q 70 82 74 79" stroke="#2DD4BF" strokeWidth="1.5" strokeLinecap="round" fill="none" />
            )}

            {/* Cute Belly Button LED or Git Branch Emblem */}
            <g className="pip-belly-symbol">
              <circle cx="70" cy="102" r="3" fill="#94A3B8" opacity="0.5" />
            </g>
          </svg>
        </div>

        {/* Quick Toolbar on Hover */}
        <div className="pip-hover-tools no-drag">
          <button
            className="tool-btn"
            title="Check All Repositories Now"
            onClick={handleCheckAll}
          >
            <RefreshCw size={12} className={state === 'checking' ? 'spinning' : ''} />
          </button>
          <button
            className="tool-btn"
            title="Toggle Speech Bubble"
            onClick={() => setShowBubble(prev => !prev)}
          >
            💬
          </button>
        </div>
      </div>
    </div>
  );
}
