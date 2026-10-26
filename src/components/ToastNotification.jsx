import React, { useEffect } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X, Download } from 'lucide-react';

export default function ToastNotification({ notifications, onDismiss, onAction }) {
  if (!notifications || notifications.length === 0) return null;

  return (
    <div className="toast-container" aria-live="polite">
      {notifications.map((toast) => (
        <ToastItem
          key={toast.id}
          toast={toast}
          onDismiss={onDismiss}
          onAction={onAction}
        />
      ))}
    </div>
  );
}

function ToastItem({ toast, onDismiss, onAction }) {
  const { id, type = 'info', title, message, repoId, duration = 5000 } = toast;

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onDismiss(id);
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [id, duration, onDismiss]);

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle2 size={18} className="toast-icon text-success" />;
      case 'warning':
        return <AlertCircle size={18} className="toast-icon text-warning" />;
      case 'error':
        return <AlertTriangle size={18} className="toast-icon text-danger" />;
      default:
        return <Info size={18} className="toast-icon text-info" />;
    }
  };

  return (
    <div className={`toast-card toast-${type}`}>
      <div className="toast-icon-wrap">
        {getIcon()}
      </div>

      <div className="toast-content">
        <h5 className="toast-title">{title}</h5>
        <p className="toast-message">{message}</p>

        {repoId && onAction && (
          <div className="toast-actions">
            <button
              className="btn-toast-action"
              onClick={() => onAction(repoId)}
            >
              <Download size={12} />
              <span>Pull Changes</span>
            </button>
          </div>
        )}
      </div>

      <button
        className="btn-toast-close"
        onClick={() => onDismiss(id)}
        title="Dismiss alert"
      >
        <X size={14} />
      </button>
    </div>
  );
}
