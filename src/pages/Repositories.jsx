import React, { useState } from 'react';
import StatusBadge from '../components/StatusBadge';
import { formatRelativeTime } from '../utils/formatTime';
import {
  FolderGit2,
  Folder,
  ExternalLink,
  Download,
  RefreshCw,
  Trash2,
  GitBranch,
  Lock,
  Globe,
  ArrowDown,
  ArrowUp,
  AlertTriangle
} from 'lucide-react';

export default function Repositories({
  repositories,
  onCheckStatus,
  onPull,
  onRemove,
  onOpenFolder,
  onOpenExternal,
  actionInProgressId,
  searchQuery
}) {
  const [confirmRepo, setConfirmRepo] = useState(null);
  const [confirmType, setConfirmType] = useState(null); // 'pull' | 'remove'
  const [pulling, setPulling] = useState(false);
  const [pullError, setPullError] = useState(null);

  const filtered = repositories.filter(repo => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      repo.name.toLowerCase().includes(q) ||
      repo.localPath.toLowerCase().includes(q) ||
      (repo.owner && repo.owner.toLowerCase().includes(q))
    );
  });

  const handlePullConfirm = async () => {
    if (!confirmRepo) return;
    setPulling(true);
    setPullError(null);
    try {
      await onPull(confirmRepo.id);
      setConfirmRepo(null);
    } catch (err) {
      setPullError(err.message);
    } finally {
      setPulling(false);
    }
  };

  const handleRemoveConfirm = () => {
    if (confirmRepo) {
      onRemove(confirmRepo.id);
      setConfirmRepo(null);
    }
  };

  return (
    <div className="repositories-page-container">
      <div className="page-header-row">
        <div>
          <h2 className="page-heading">Tracked Repositories</h2>
          <p className="page-subheading">
            Manage your synchronized Git workspaces and inspect their local working trees.
          </p>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="empty-dashboard-box">
          <FolderGit2 size={40} className="empty-icon" />
          <p>No repositories match your search.</p>
        </div>
      ) : (
        <div className="repositories-table-card">
          <table className="repos-data-table">
            <thead>
              <tr>
                <th>Repository</th>
                <th>Branch</th>
                <th>Working Tree</th>
                <th>Sync Status</th>
                <th>Delta</th>
                <th>Last Checked</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(repo => {
                const isOperating = actionInProgressId === repo.id;
                return (
                  <tr key={repo.id} className="repo-table-row">
                    <td>
                      <div className="table-repo-name-cell">
                        {repo.isPrivate ? (
                          <Lock size={13} className="lock-icon" title="Private" />
                        ) : (
                          <Globe size={13} className="globe-icon" title="Public" />
                        )}
                        <div>
                          <strong className="cell-repo-name">{repo.name}</strong>
                          <div className="cell-repo-path" title={repo.localPath}>
                            {repo.localPath}
                          </div>
                        </div>
                      </div>
                    </td>

                    <td>
                      <div className="cell-branch-tag">
                        <GitBranch size={13} />
                        <span>{repo.currentBranch || repo.defaultBranch || 'main'}</span>
                      </div>
                    </td>

                    <td>
                      <span className={`cell-tree-tag ${repo.isClean ? 'clean' : 'dirty'}`}>
                        {repo.isClean ? '✓ Clean' : '⚠ Modified'}
                      </span>
                    </td>

                    <td>
                      <StatusBadge
                        status={repo.status}
                        behindCount={repo.behindCount}
                        aheadCount={repo.aheadCount}
                      />
                    </td>

                    <td>
                      <div className="cell-delta-box">
                        <span className={`delta-tag ${repo.behindCount > 0 ? 'behind' : ''}`}>
                          <ArrowDown size={11} /> {repo.behindCount || 0}
                        </span>
                        <span className={`delta-tag ${repo.aheadCount > 0 ? 'ahead' : ''}`}>
                          <ArrowUp size={11} /> {repo.aheadCount || 0}
                        </span>
                      </div>
                    </td>

                    <td>
                      <span className="cell-time">{formatRelativeTime(repo.lastCheckedAt)}</span>
                    </td>

                    <td className="text-right">
                      <div className="table-row-actions">
                        <button
                          className="btn-table-action"
                          onClick={() => {
                            setConfirmRepo(repo);
                            setConfirmType('pull');
                            setPullError(null);
                          }}
                          disabled={isOperating}
                          title="Pull changes (ff-only)"
                        >
                          <Download size={14} />
                        </button>
                        <button
                          className="btn-table-action"
                          onClick={() => onCheckStatus(repo.id)}
                          disabled={isOperating}
                          title="Check status"
                        >
                          <RefreshCw size={14} className={isOperating ? 'spinning' : ''} />
                        </button>
                        <button
                          className="btn-table-action"
                          onClick={() => onOpenFolder(repo.localPath)}
                          title="Open local folder"
                        >
                          <Folder size={14} />
                        </button>
                        {repo.fullName && (
                          <button
                            className="btn-table-action"
                            onClick={() => onOpenExternal(`https://github.com/${repo.fullName}`)}
                            title="Open on GitHub"
                          >
                            <ExternalLink size={14} />
                          </button>
                        )}
                        <button
                          className="btn-table-action text-danger"
                          onClick={() => {
                            setConfirmRepo(repo);
                            setConfirmType('remove');
                          }}
                          title="Untrack repository"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Confirmation Modal */}
      {confirmRepo && (
        <div className="card-modal-backdrop">
          <div className="card-modal">
            {confirmType === 'pull' ? (
              <>
                <h4 className="modal-title">Fast-Forward Pull</h4>
                <p className="modal-text">
                  Pull latest changes into <strong>{confirmRepo.name}</strong> from remote branch?
                </p>
                {!confirmRepo.isClean && (
                  <div className="modal-warning-box">
                    <AlertTriangle size={15} />
                    <span>Uncommitted changes exist. Commit or stash them before pulling.</span>
                  </div>
                )}
                {pullError && (
                  <div className="modal-error-box">
                    <AlertTriangle size={15} />
                    <span>{pullError}</span>
                  </div>
                )}
                <div className="modal-actions">
                  <button
                    className="btn-modal btn-cancel"
                    onClick={() => setConfirmRepo(null)}
                    disabled={pulling}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn-modal btn-confirm"
                    onClick={handlePullConfirm}
                    disabled={pulling}
                  >
                    {pulling ? 'Pulling...' : 'Confirm Pull'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <h4 className="modal-title">Untrack Repository</h4>
                <p className="modal-text">
                  Stop tracking <strong>{confirmRepo.name}</strong>? Local files will remain untouched.
                </p>
                <div className="modal-actions">
                  <button className="btn-modal btn-cancel" onClick={() => setConfirmRepo(null)}>
                    Cancel
                  </button>
                  <button className="btn-modal btn-danger" onClick={handleRemoveConfirm}>
                    Untrack
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
