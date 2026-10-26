import React, { useState } from 'react';
import StatusBadge from './StatusBadge';
import { formatRelativeTime } from '../utils/formatTime';
import {
  GitBranch,
  Folder,
  ExternalLink,
  Download,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Lock,
  Globe,
  ArrowDown,
  ArrowUp
} from 'lucide-react';

export default function RepositoryCard({
  repo,
  onCheckStatus,
  onPull,
  onRemove,
  onOpenFolder,
  onOpenExternal,
  isOperating
}) {
  const [showPullConfirm, setShowPullConfirm] = useState(false);
  const [showRemoveConfirm, setShowRemoveConfirm] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pullError, setPullError] = useState(null);

  const handlePullConfirm = async () => {
    setPulling(true);
    setPullError(null);
    try {
      await onPull(repo.id);
      setShowPullConfirm(false);
    } catch (err) {
      setPullError(err.message);
    } finally {
      setPulling(false);
    }
  };

  const handleRemoveConfirm = () => {
    onRemove(repo.id);
    setShowRemoveConfirm(false);
  };

  const hasUncommitted = !repo.isClean;
  const isBehind = repo.status === 'behind' || repo.behindCount > 0;

  return (
    <div className={`repo-card ${isBehind ? 'repo-card-attention' : ''}`}>
      <div className="repo-card-header">
        <div className="repo-title-section">
          <div className="repo-name-row">
            {repo.isPrivate ? (
              <Lock size={15} className="repo-privacy-icon private" title="Private Repository" />
            ) : (
              <Globe size={15} className="repo-privacy-icon public" title="Public Repository" />
            )}
            <h3 className="repo-name" title={repo.fullName || repo.name}>
              {repo.name}
            </h3>
            {repo.owner && <span className="repo-owner">({repo.owner})</span>}
          </div>
          <div className="repo-path-row" title={repo.localPath}>
            <Folder size={13} className="repo-path-icon" />
            <span className="repo-path-text">{repo.localPath}</span>
          </div>
        </div>

        <div className="repo-badge-section">
          <StatusBadge
            status={repo.status}
            behindCount={repo.behindCount}
            aheadCount={repo.aheadCount}
          />
        </div>
      </div>

      {/* Branch & Sync Metrics Row */}
      <div className="repo-metrics-grid">
        <div className="metric-item">
          <span className="metric-label">Current Branch</span>
          <div className="metric-value branch-tag">
            <GitBranch size={13} />
            <span>{repo.currentBranch || repo.defaultBranch || 'main'}</span>
          </div>
        </div>

        <div className="metric-item">
          <span className="metric-label">Remote Upstream</span>
          <span className="metric-value text-muted">
            {repo.trackingBranch || 'No upstream'}
          </span>
        </div>

        <div className="metric-item">
          <span className="metric-label">Sync Delta</span>
          <div className="metric-value sync-delta">
            <span className={`delta-tag ${repo.behindCount > 0 ? 'behind' : ''}`} title="Incoming commits from remote">
              <ArrowDown size={12} /> {repo.behindCount || 0}
            </span>
            <span className={`delta-tag ${repo.aheadCount > 0 ? 'ahead' : ''}`} title="Local unpushed commits">
              <ArrowUp size={12} /> {repo.aheadCount || 0}
            </span>
          </div>
        </div>

        <div className="metric-item">
          <span className="metric-label">Working Tree</span>
          <span className={`metric-value ${repo.isClean ? 'clean-text' : 'dirty-text'}`}>
            {repo.isClean ? '✓ Clean' : '⚠ Modified'}
          </span>
        </div>

        <div className="metric-item">
          <span className="metric-label">Last Checked</span>
          <span className="metric-value text-muted">
            {formatRelativeTime(repo.lastCheckedAt)}
          </span>
        </div>
      </div>

      {/* Error Banner if any */}
      {repo.lastError && repo.status !== 'up_to_date' && (
        <div className="repo-error-banner">
          <AlertTriangle size={13} className="error-icon" />
          <span className="error-text">{repo.lastError}</span>
        </div>
      )}

      {/* Action Buttons Toolbar */}
      <div className="repo-card-footer">
        <div className="footer-left-actions">
          {/* Safe Pull Button */}
          <button
            className={`btn-action btn-pull ${isBehind ? 'btn-pull-highlight' : ''}`}
            onClick={() => setShowPullConfirm(true)}
            disabled={isOperating || repo.status === 'repo_unavailable'}
            title="Safely pull latest changes from remote (Fast-forward only)"
          >
            <Download size={14} />
            <span>Pull Changes {repo.behindCount > 0 ? `(${repo.behindCount})` : ''}</span>
          </button>

          {/* Check Status */}
          <button
            className="btn-action btn-secondary"
            onClick={() => onCheckStatus(repo.id)}
            disabled={isOperating}
            title="Fetch remote and check status"
          >
            <RefreshCw size={14} className={isOperating ? 'spinning' : ''} />
            <span>Check</span>
          </button>
        </div>

        <div className="footer-right-actions">
          {/* Open Local Folder */}
          <button
            className="btn-icon"
            onClick={() => onOpenFolder(repo.localPath)}
            title="Open in Windows Explorer"
          >
            <Folder size={15} />
          </button>

          {/* Open on GitHub */}
          {repo.fullName && (
            <button
              className="btn-icon"
              onClick={() => onOpenExternal(`https://github.com/${repo.fullName}`)}
              title="Open repository on GitHub"
            >
              <ExternalLink size={15} />
            </button>
          )}

          {/* Remove from PullMate */}
          <button
            className="btn-icon btn-icon-danger"
            onClick={() => setShowRemoveConfirm(true)}
            title="Remove from PullMate tracking"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      {/* Safe Pull Confirmation Modal */}
      {showPullConfirm && (
        <div className="card-modal-backdrop">
          <div className="card-modal">
            <h4 className="modal-title">Confirm Fast-Forward Pull</h4>
            <p className="modal-text">
              PullMate will synchronize <strong>{repo.name}</strong> from <code>{repo.trackingBranch || 'origin/main'}</code> using fast-forward only.
            </p>

            {hasUncommitted && (
              <div className="modal-warning-box">
                <AlertTriangle size={16} />
                <div>
                  <strong>Uncommitted local changes detected!</strong>
                  <p>Pulling now may overwrite or conflict with your unsaved work. Git will prevent merges with modified files.</p>
                </div>
              </div>
            )}

            {pullError && (
              <div className="modal-error-box">
                <AlertTriangle size={16} />
                <span>{pullError}</span>
              </div>
            )}

            <div className="modal-actions">
              <button
                className="btn-modal btn-cancel"
                onClick={() => { setShowPullConfirm(false); setPullError(null); }}
                disabled={pulling}
              >
                Cancel
              </button>
              <button
                className="btn-modal btn-confirm"
                onClick={handlePullConfirm}
                disabled={pulling}
              >
                {pulling ? 'Pulling...' : 'Yes, Pull Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Confirmation Modal */}
      {showRemoveConfirm && (
        <div className="card-modal-backdrop">
          <div className="card-modal">
            <h4 className="modal-title">Untrack Repository?</h4>
            <p className="modal-text">
              Are you sure you want to stop tracking <strong>{repo.name}</strong> in PullMate?
            </p>
            <div className="modal-safe-note">
              ✓ Your local repository folder and files will <strong>not</strong> be deleted.
            </div>
            <div className="modal-actions">
              <button
                className="btn-modal btn-cancel"
                onClick={() => setShowRemoveConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="btn-modal btn-danger"
                onClick={handleRemoveConfirm}
              >
                Stop Tracking
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
