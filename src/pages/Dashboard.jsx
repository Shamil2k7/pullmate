import React, { useState } from 'react';
import RepositoryCard from '../components/RepositoryCard';
import { formatDateTime, formatRelativeTime } from '../utils/formatTime';
import {
  FolderGit2,
  AlertCircle,
  CheckCircle2,
  Clock,
  Plus,
  RefreshCw,
  Folder,
  Download,
  Link2,
  X,
  AlertTriangle
} from 'lucide-react';

export default function Dashboard({
  repositories,
  settings,
  onCheckAll,
  isCheckingAll,
  onCheckStatus,
  onPull,
  onRemove,
  onOpenFolder,
  onOpenExternal,
  onAddRepository,
  actionInProgressId,
  searchQuery
}) {
  const [filterMode, setFilterMode] = useState('all'); // 'all' | 'attention' | 'synced'
  const [showAddModal, setShowAddModal] = useState(false);

  // Add repo modal states
  const [addMode, setAddMode] = useState('link'); // 'link' | 'clone'
  const [localFolderInput, setLocalFolderInput] = useState('');
  const [cloneUrlInput, setCloneUrlInput] = useState('');
  const [cloneParentDir, setCloneParentDir] = useState('');
  const [cloneFolderName, setCloneFolderName] = useState('');
  const [addError, setAddError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Summary Metrics calculated strictly from real repository data
  const totalTracked = repositories.length;
  const needingAttention = repositories.filter(
    r => r.status === 'behind' || r.status === 'diverged' || r.behindCount > 0 || r.status === 'fetch_failed'
  );
  const upToDate = repositories.filter(r => r.status === 'up_to_date' && r.behindCount === 0);
  const lastCheckTime = settings.lastGlobalCheckAt;

  // Filter repositories based on query & active tab
  const filteredRepos = repositories.filter(repo => {
    // Search query matching
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      const matchName = repo.name.toLowerCase().includes(q);
      const matchPath = repo.localPath.toLowerCase().includes(q);
      const matchOwner = repo.owner && repo.owner.toLowerCase().includes(q);
      if (!matchName && !matchPath && !matchOwner) return false;
    }

    // Status filter
    if (filterMode === 'attention') {
      return repo.status === 'behind' || repo.status === 'diverged' || repo.behindCount > 0 || repo.status === 'fetch_failed';
    }
    if (filterMode === 'synced') {
      return repo.status === 'up_to_date' && repo.behindCount === 0;
    }
    return true;
  });

  const handleSelectLinkFolder = async () => {
    try {
      const selected = await window.pullmateApi?.repositories?.selectDirectory();
      if (selected) {
        setLocalFolderInput(selected);
        setAddError(null);
      }
    } catch (err) {
      setAddError(err.message);
    }
  };

  const handleSelectCloneParentDir = async () => {
    try {
      const selected = await window.pullmateApi?.repositories?.selectDirectory();
      if (selected) {
        setCloneParentDir(selected);
        setAddError(null);
      }
    } catch (err) {
      setAddError(err.message);
    }
  };

  const handleAddSubmit = async (e) => {
    e.preventDefault();
    setAddError(null);
    setIsSubmitting(true);

    try {
      if (addMode === 'link') {
        if (!localFolderInput) throw new Error('Please select a local repository folder');
        // Validate folder
        const validation = await window.pullmateApi?.repositories?.validateFolder(localFolderInput);
        if (!validation.isRepo) {
          throw new Error('The selected folder is not a valid Git repository (.git not found)');
        }
        await onAddRepository({
          localPath: localFolderInput,
          name: validation.rootPath.split(/[\\/]/).pop()
        });
      } else {
        if (!cloneUrlInput || !cloneParentDir || !cloneFolderName) {
          throw new Error('Please fill all clone fields: Clone URL, Destination Directory, and Folder Name');
        }
        const cloneResult = await window.pullmateApi?.repositories?.clone(
          cloneUrlInput.trim(),
          cloneParentDir,
          cloneFolderName.trim()
        );
        await onAddRepository({
          localPath: cloneResult.destinationPath,
          name: cloneFolderName.trim()
        });
      }

      setShowAddModal(false);
      setLocalFolderInput('');
      setCloneUrlInput('');
      setCloneParentDir('');
      setCloneFolderName('');
    } catch (err) {
      setAddError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="dashboard-page-container">
      {/* Summary Cards Row */}
      <div className="summary-cards-grid">
        <div className="summary-card">
          <div className="summary-icon-box total">
            <FolderGit2 size={22} />
          </div>
          <div className="summary-info">
            <span className="summary-label">Tracked Repositories</span>
            <span className="summary-value">{totalTracked}</span>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon-box attention">
            <AlertCircle size={22} />
          </div>
          <div className="summary-info">
            <span className="summary-label">Needing Attention</span>
            <span className="summary-value text-attention">{needingAttention.length}</span>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon-box synced">
            <CheckCircle2 size={22} />
          </div>
          <div className="summary-info">
            <span className="summary-label">Up to Date</span>
            <span className="summary-value text-success">{upToDate.length}</span>
          </div>
        </div>

        <div className="summary-card">
          <div className="summary-icon-box clock">
            <Clock size={22} />
          </div>
          <div className="summary-info">
            <span className="summary-label">Last Successful Check</span>
            <span className="summary-value text-small">{formatRelativeTime(lastCheckTime)}</span>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="dashboard-content-header">
        <div className="filter-pills-row">
          <button
            className={`filter-pill ${filterMode === 'all' ? 'active' : ''}`}
            onClick={() => setFilterMode('all')}
          >
            All Repositories ({totalTracked})
          </button>
          <button
            className={`filter-pill ${filterMode === 'attention' ? 'active' : ''}`}
            onClick={() => setFilterMode('attention')}
          >
            Needs Attention ({needingAttention.length})
          </button>
          <button
            className={`filter-pill ${filterMode === 'synced' ? 'active' : ''}`}
            onClick={() => setFilterMode('synced')}
          >
            Synchronized ({upToDate.length})
          </button>
        </div>

        <button className="btn-add-repo-accent" onClick={() => setShowAddModal(true)}>
          <Plus size={15} />
          <span>Track Repository</span>
        </button>
      </div>

      {/* Repository Cards Grid */}
      {filteredRepos.length === 0 ? (
        <div className="empty-dashboard-box">
          <FolderGit2 size={48} className="empty-icon" />
          <h3>No repositories found</h3>
          <p>
            {totalTracked === 0
              ? "You haven't added any repositories to PullMate yet. Add one to let Pip watch it!"
              : 'No repositories match the current filter or search criteria.'}
          </p>
          {totalTracked === 0 && (
            <button className="btn-empty-action" onClick={() => setShowAddModal(true)}>
              <Plus size={16} />
              <span>Add Your First Repository</span>
            </button>
          )}
        </div>
      ) : (
        <div className="repository-cards-grid">
          {filteredRepos.map(repo => (
            <RepositoryCard
              key={repo.id}
              repo={repo}
              onCheckStatus={onCheckStatus}
              onPull={onPull}
              onRemove={onRemove}
              onOpenFolder={onOpenFolder}
              onOpenExternal={onOpenExternal}
              isOperating={actionInProgressId === repo.id}
            />
          ))}
        </div>
      )}

      {/* Add Repository Modal */}
      {showAddModal && (
        <div className="card-modal-backdrop">
          <div className="card-modal modal-wide">
            <div className="modal-header-row">
              <h3 className="modal-title">Track a New Repository</h3>
              <button className="btn-close-modal" onClick={() => setShowAddModal(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="modal-mode-tabs">
              <button
                className={`modal-mode-btn ${addMode === 'link' ? 'active' : ''}`}
                onClick={() => setAddMode('link')}
              >
                <Link2 size={15} />
                <span>Link Local Git Folder</span>
              </button>
              <button
                className={`modal-mode-btn ${addMode === 'clone' ? 'active' : ''}`}
                onClick={() => setAddMode('clone')}
              >
                <Download size={15} />
                <span>Clone from Git URL</span>
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="modal-form">
              {addMode === 'link' ? (
                <div className="form-group">
                  <label className="input-label">Select Local Repository Folder</label>
                  <div className="folder-input-row">
                    <input
                      type="text"
                      readOnly
                      placeholder="e.g. D:\Projects\MyRepo"
                      value={localFolderInput}
                      className="folder-path-input"
                    />
                    <button type="button" className="btn-browse" onClick={handleSelectLinkFolder}>
                      <Folder size={14} /> Browse...
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="form-group">
                    <label className="input-label">Git Clone URL (HTTPS or SSH)</label>
                    <input
                      type="text"
                      placeholder="https://github.com/owner/repository.git"
                      value={cloneUrlInput}
                      onChange={(e) => setCloneUrlInput(e.target.value)}
                      className="text-input"
                    />
                  </div>

                  <div className="form-group">
                    <label className="input-label">Destination Parent Directory</label>
                    <div className="folder-input-row">
                      <input
                        type="text"
                        readOnly
                        placeholder="Choose folder where repo will be cloned"
                        value={cloneParentDir}
                        className="folder-path-input"
                      />
                      <button type="button" className="btn-browse" onClick={handleSelectCloneParentDir}>
                        <Folder size={14} /> Browse...
                      </button>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="input-label">Target Folder Name</label>
                    <input
                      type="text"
                      placeholder="e.g. my-project"
                      value={cloneFolderName}
                      onChange={(e) => setCloneFolderName(e.target.value)}
                      className="text-input"
                    />
                  </div>
                </>
              )}

              {addError && (
                <div className="modal-error-box">
                  <AlertTriangle size={15} />
                  <span>{addError}</span>
                </div>
              )}

              <div className="modal-actions">
                <button
                  type="button"
                  className="btn-modal btn-cancel"
                  onClick={() => setShowAddModal(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-modal btn-confirm"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <RefreshCw size={14} className="spinning" />
                      <span>{addMode === 'clone' ? 'Cloning...' : 'Adding...'}</span>
                    </>
                  ) : (
                    <span>{addMode === 'clone' ? 'Clone & Track' : 'Add to PullMate'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
