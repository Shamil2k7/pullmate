/**
 * Utility functions for formatting dates, relative times, and status strings
 */

export function formatRelativeTime(isoString) {
  if (!isoString) return 'Never';
  const date = new Date(isoString);
  const now = new Date();
  const diffSeconds = Math.round((now - date) / 1000);

  if (diffSeconds < 10) return 'Just now';
  if (diffSeconds < 60) return `${diffSeconds}s ago`;

  const diffMinutes = Math.round(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatDateTime(isoString) {
  if (!isoString) return 'Never';
  const date = new Date(isoString);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function getStatusLabel(status) {
  switch (status) {
    case 'up_to_date':
      return 'Up to date';
    case 'behind':
      return 'Behind remote';
    case 'ahead':
      return 'Ahead of remote';
    case 'diverged':
      return 'Diverged branches';
    case 'no_upstream':
      return 'No upstream branch';
    case 'uncommitted_changes':
      return 'Uncommitted changes';
    case 'checking':
      return 'Checking status...';
    case 'fetch_failed':
      return 'Fetch failed';
    case 'auth_required':
      return 'Auth required';
    case 'repo_unavailable':
      return 'Folder missing';
    default:
      return 'Unknown';
  }
}

export function getStatusColor(status) {
  switch (status) {
    case 'up_to_date':
      return { bg: '#E8F5E9', text: '#2E7D32', border: '#C8E6C9' };
    case 'behind':
      return { bg: '#FFF3E0', text: '#E65100', border: '#FFE0B2' };
    case 'ahead':
      return { bg: '#E3F2FD', text: '#1565C0', border: '#BBDEFB' };
    case 'diverged':
      return { bg: '#FCE4EC', text: '#C2185B', border: '#F8BBD0' };
    case 'uncommitted_changes':
      return { bg: '#FFF8E1', text: '#F57F17', border: '#FFECB3' };
    case 'no_upstream':
      return { bg: '#F3E5F5', text: '#7B1FA2', border: '#E1BEE7' };
    case 'checking':
      return { bg: '#ECEFF1', text: '#455A64', border: '#CFD8DC' };
    case 'fetch_failed':
    case 'auth_required':
    case 'repo_unavailable':
      return { bg: '#FFEBEE', text: '#C62828', border: '#FFCDD2' };
    default:
      return { bg: '#F5F5F5', text: '#616161', border: '#E0E0E0' };
  }
}
