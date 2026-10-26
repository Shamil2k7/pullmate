import React from 'react';
import { getStatusLabel, getStatusColor } from '../utils/formatTime';
import { CheckCircle2, ArrowDownCircle, ArrowUpCircle, GitFork, AlertCircle, RefreshCw, FolderX } from 'lucide-react';

export default function StatusBadge({ status, behindCount = 0, aheadCount = 0 }) {
  const label = getStatusLabel(status);
  const color = getStatusColor(status);

  const renderIcon = () => {
    switch (status) {
      case 'up_to_date':
        return <CheckCircle2 size={13} className="badge-icon" />;
      case 'behind':
        return <ArrowDownCircle size={13} className="badge-icon" />;
      case 'ahead':
        return <ArrowUpCircle size={13} className="badge-icon" />;
      case 'diverged':
        return <GitFork size={13} className="badge-icon" />;
      case 'checking':
        return <RefreshCw size={13} className="badge-icon spinning" />;
      case 'repo_unavailable':
        return <FolderX size={13} className="badge-icon" />;
      default:
        return <AlertCircle size={13} className="badge-icon" />;
    }
  };

  return (
    <span
      className={`status-badge status-${status}`}
      style={{
        backgroundColor: color.bg,
        color: color.text,
        borderColor: color.border
      }}
    >
      {renderIcon()}
      <span className="badge-label">
        {status === 'behind' && behindCount > 0 ? `${behindCount} behind` : label}
      </span>
    </span>
  );
}
