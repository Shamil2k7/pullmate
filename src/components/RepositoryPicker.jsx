import React, { useState, useEffect, useCallback } from 'react';
import { Search, Lock, Globe, RefreshCw, AlertCircle, CheckSquare, Square, GitBranch } from 'lucide-react';
import { formatRelativeTime } from '../utils/formatTime';

export default function RepositoryPicker({ selectedRepos, onSelectionChange, onNext, onBack }) {
  const [repositories, setRepositories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [hasNextPage, setHasNextPage] = useState(false);

  const loadGitHubRepos = useCallback(async (targetPage = 1) => {
    setLoading(true);
    setError(null);
    try {
      if (!window.pullmateApi?.auth?.getUserRepositories) {
        throw new Error('GitHub API bridge is not available');
      }
      const data = await window.pullmateApi.auth.getUserRepositories(targetPage, 30);
      setRepositories(data.repositories || []);
      setHasNextPage(Boolean(data.hasNextPage));
      setPage(targetPage);
    } catch (err) {
      setError(err.message || 'Failed to fetch repositories from GitHub');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGitHubRepos(1);
  }, [loadGitHubRepos]);

  const filteredRepos = repositories.filter(repo => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return repo.name.toLowerCase().includes(q) || (repo.owner && repo.owner.toLowerCase().includes(q));
  });

  const toggleRepo = (repo) => {
    const isSelected = selectedRepos.some(r => r.id === repo.id);
    if (isSelected) {
      onSelectionChange(selectedRepos.filter(r => r.id !== repo.id));
    } else {
      onSelectionChange([...selectedRepos, repo]);
    }
  };

  const handleSelectAll = () => {
    const newSelected = [...selectedRepos];
    filteredRepos.forEach(repo => {
      if (!newSelected.some(r => r.id === repo.id)) {
        newSelected.push(repo);
      }
    });
    onSelectionChange(newSelected);
  };

  const handleDeselectAll = () => {
    const filteredIds = new Set(filteredRepos.map(r => r.id));
    onSelectionChange(selectedRepos.filter(r => !filteredIds.has(r.id)));
  };

  return (
    <div className="wizard-step-container">
      <div className="wizard-step-header">
        <h2 className="step-title">Select GitHub Repositories</h2>
        <p className="step-description">
          Choose which repositories you want PullMate to watch and remind you to synchronize.
        </p>
      </div>

      {/* Search & Bulk Select Controls */}
      <div className="picker-controls-row">
        <div className="picker-search-box">
          <Search size={15} />
          <input
            type="text"
            placeholder="Search your repositories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="picker-bulk-actions">
          <button className="btn-bulk" onClick={handleSelectAll}>
            <CheckSquare size={14} /> Select Page
          </button>
          <button className="btn-bulk" onClick={handleDeselectAll}>
            <Square size={14} /> Deselect Page
          </button>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="picker-loading-box">
          <RefreshCw size={24} className="spinning text-accent" />
          <p>Fetching your repositories from GitHub...</p>
        </div>
      ) : error ? (
        <div className="picker-error-box">
          <AlertCircle size={28} className="text-danger" />
          <p className="error-title">Couldn't Load Repositories</p>
          <p className="error-desc">{error}</p>
          <button className="btn-retry" onClick={() => loadGitHubRepos(page)}>
            <RefreshCw size={14} /> Retry
          </button>
        </div>
      ) : filteredRepos.length === 0 ? (
        <div className="picker-empty-box">
          <p>No repositories found matching "{searchQuery}"</p>
        </div>
      ) : (
        <div className="picker-list-wrapper">
          <div className="picker-repo-list">
            {filteredRepos.map(repo => {
              const isSelected = selectedRepos.some(r => r.id === repo.id);
              return (
                <div
                  key={repo.id}
                  className={`picker-repo-item ${isSelected ? 'selected' : ''}`}
                  onClick={() => toggleRepo(repo)}
                >
                  <div className="picker-checkbox">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // Controlled by row click
                    />
                  </div>

                  <div className="picker-repo-info">
                    <div className="picker-name-row">
                      {repo.isPrivate ? (
                        <Lock size={13} className="lock-icon" title="Private" />
                      ) : (
                        <Globe size={13} className="globe-icon" title="Public" />
                      )}
                      <span className="picker-repo-name">{repo.name}</span>
                      <span className="picker-repo-owner">({repo.owner})</span>
                    </div>

                    <div className="picker-meta-row">
                      <span className="picker-branch-tag">
                        <GitBranch size={11} /> {repo.defaultBranch || 'main'}
                      </span>
                      <span className="picker-updated-tag">
                        Updated {formatRelativeTime(repo.updatedAt)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pagination Controls */}
          <div className="picker-pagination-bar">
            <button
              className="btn-page"
              disabled={page <= 1 || loading}
              onClick={() => loadGitHubRepos(page - 1)}
            >
              Previous Page
            </button>
            <span className="page-indicator">Page {page}</span>
            <button
              className="btn-page"
              disabled={!hasNextPage || loading}
              onClick={() => loadGitHubRepos(page + 1)}
            >
              Next Page
            </button>
          </div>
        </div>
      )}

      {/* Footer Navigation */}
      <div className="wizard-footer">
        <button className="btn-wizard-back" onClick={onBack}>
          Back
        </button>
        <div className="wizard-footer-right">
          <span className="selected-count-badge">
            {selectedRepos.length} repositor{selectedRepos.length === 1 ? 'y' : 'ies'} selected
          </span>
          <button
            className="btn-wizard-next"
            disabled={selectedRepos.length === 0}
            onClick={onNext}
          >
            Continue to Local Setup
          </button>
        </div>
      </div>
    </div>
  );
}
