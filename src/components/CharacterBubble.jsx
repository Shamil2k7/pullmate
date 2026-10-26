import React from 'react';
import { X, ExternalLink, Download, EyeOff, Folder, Minus } from 'lucide-react';

export default function CharacterBubble({ message, action, onClose, onHideCharacter, onMinimize, onOpenMainWindow }) {
  const handleActionClick = async () => {
    if (!action) return;

    if (action.type === 'open_dashboard') {
      window.pullmateApi?.character?.openMainWindow();
    } else if (action.type === 'pull' && action.repoId) {
      try {
        await window.pullmateApi?.repositories?.pull(action.repoId);
      } catch (err) {
        console.error('Failed to pull from bubble action:', err);
      }
    } else if (action.type === 'open_folder' && action.repoId) {
      const repos = await window.pullmateApi?.repositories?.getAll();
      const target = repos?.find(r => r.id === action.repoId);
      if (target?.localPath) {
        window.pullmateApi?.repositories?.openFolder(target.localPath);
      }
    }
  };

  return (
    <div className="character-bubble-container no-drag">
      <div className="character-bubble-header">
        <span className="character-bubble-title">Pip</span>
        <div className="character-bubble-controls">
          {onMinimize && (
            <button
              className="bubble-icon-btn"
              title="Minimize Pip to Bottom Left"
              onClick={onMinimize}
            >
              <Minus size={12} />
            </button>
          )}
          <button
            className="bubble-icon-btn"
            title="Open PullMate Dashboard"
            onClick={onOpenMainWindow}
          >
            <ExternalLink size={12} />
          </button>
          <button
            className="bubble-icon-btn"
            title="Hide Pip from Desktop"
            onClick={onHideCharacter}
          >
            <EyeOff size={12} />
          </button>
          {onClose && (
            <button
              className="bubble-icon-btn"
              title="Dismiss Message"
              onClick={onClose}
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      <div className="character-bubble-body">
        <p className="bubble-message-text">{message || "I'm keeping an eye on your Git repos!"}</p>
      </div>

      {action && (
        <div className="character-bubble-actions">
          <button className="bubble-action-btn primary" onClick={handleActionClick}>
            {action.type === 'pull' && <Download size={13} className="action-icon" />}
            {action.type === 'open_folder' && <Folder size={13} className="action-icon" />}
            {action.type === 'open_dashboard' && <ExternalLink size={13} className="action-icon" />}
            <span>{action.label || 'Action'}</span>
          </button>
        </div>
      )}
      <div className="character-bubble-tail" />
    </div>
  );
}
