import React from 'react';
import { formatDateTime, formatRelativeTime } from '../utils/formatTime';
import StatusBadge from '../components/StatusBadge';
import { Activity as ActivityIcon, CheckCircle2, ArrowDownCircle, AlertCircle, RefreshCw } from 'lucide-react';

export default function Activity({ repositories, settings, onCheckAll, isCheckingAll }) {
  // Aggregate real events from tracked repository states
  const events = repositories.map(r => ({
    id: r.id,
    repoName: r.name,
    localPath: r.localPath,
    status: r.status,
    behindCount: r.behindCount,
    aheadCount: r.aheadCount,
    lastCheckedAt: r.lastCheckedAt,
    lastSuccessfulFetchAt: r.lastSuccessfulFetchAt,
    lastError: r.lastError
  })).sort((a, b) => {
    const timeA = a.lastCheckedAt ? Date.parse(a.lastCheckedAt) : 0;
    const timeB = b.lastCheckedAt ? Date.parse(b.lastCheckedAt) : 0;
    return timeB - timeA;
  });

  return (
    <div className="activity-page-container">
      <div className="page-header-row">
        <div>
          <h2 className="page-heading">Synchronization Activity</h2>
          <p className="page-subheading">
            Live log of recent repository status checks and synchronization audits.
          </p>
        </div>

        <button
          className="btn-topbar btn-refresh"
          onClick={onCheckAll}
          disabled={isCheckingAll}
        >
          <RefreshCw size={14} className={isCheckingAll ? 'spinning' : ''} />
          <span>{isCheckingAll ? 'Checking...' : 'Refresh Activity'}</span>
        </button>
      </div>

      {events.length === 0 ? (
        <div className="empty-dashboard-box">
          <ActivityIcon size={40} className="empty-icon" />
          <p>No activity yet. Track a repository to start monitoring Git operations.</p>
        </div>
      ) : (
        <div className="activity-timeline-card">
          <div className="activity-stream">
            {events.map((evt, idx) => (
              <div key={evt.id} className="activity-stream-item">
                <div className="stream-time-col">
                  <span className="stream-relative-time">{formatRelativeTime(evt.lastCheckedAt)}</span>
                  <span className="stream-exact-time">{formatDateTime(evt.lastCheckedAt)}</span>
                </div>

                <div className="stream-node">
                  <div className={`node-dot status-${evt.status}`} />
                  {idx < events.length - 1 && <div className="node-line" />}
                </div>

                <div className="stream-content-card">
                  <div className="stream-card-header">
                    <span className="stream-repo-name">{evt.repoName}</span>
                    <StatusBadge
                      status={evt.status}
                      behindCount={evt.behindCount}
                      aheadCount={evt.aheadCount}
                    />
                  </div>

                  <p className="stream-detail-text">
                    {evt.status === 'up_to_date' && 'Repository checked and confirmed up to date with remote branch.'}
                    {evt.status === 'behind' && `Repository is ${evt.behindCount} commit${evt.behindCount > 1 ? 's' : ''} behind remote. Ready for fast-forward pull.`}
                    {evt.status === 'ahead' && `Repository has ${evt.aheadCount} unpushed local commit${evt.aheadCount > 1 ? 's' : ''}.`}
                    {evt.status === 'diverged' && 'Branches have diverged with both local and remote commits.'}
                    {evt.status === 'uncommitted_changes' && 'Uncommitted local modifications detected.'}
                    {evt.status === 'fetch_failed' && `Fetch failed: ${evt.lastError || 'Network unreachable'}`}
                    {evt.status === 'no_upstream' && 'Branch has no tracking upstream configured.'}
                    {evt.status === 'checking' && 'Inspection currently in progress...'}
                  </p>

                  <div className="stream-meta-footer">
                    <code>{evt.localPath}</code>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
