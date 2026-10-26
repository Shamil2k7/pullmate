import React, { useState } from 'react';
import { Folder, Download, Link2, CheckCircle2, AlertTriangle, RefreshCw, SkipForward } from 'lucide-react';

export default function CloneDialog({ selectedRepos, onSetupComplete, onBack }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [configuredRepos, setConfiguredRepos] = useState([]);
  const [activeMode, setActiveMode] = useState('clone'); // 'clone' | 'link'
  
  // Clone state
  const [parentDir, setParentDir] = useState('');
  const [cloning, setCloning] = useState(false);
  const [cloneProgress, setCloneProgress] = useState('');
  const [cloneError, setCloneError] = useState(null);

  // Link state
  const [linkedFolder, setLinkedFolder] = useState('');
  const [validating, setValidating] = useState(false);
  const [linkValidation, setLinkValidation] = useState(null);
  const [linkError, setLinkError] = useState(null);

  const currentRepo = selectedRepos[currentIndex];

  // Directory picker helper
  const handleSelectParentDir = async () => {
    try {
      const selected = await window.pullmateApi?.repositories?.selectDirectory();
      if (selected) {
        setParentDir(selected);
        setCloneError(null);
      }
    } catch (err) {
      setCloneError(err.message);
    }
  };

  const handleSelectLinkFolder = async () => {
    try {
      const selected = await window.pullmateApi?.repositories?.selectDirectory();
      if (selected) {
        setLinkedFolder(selected);
        setLinkError(null);
        validateLinkedFolder(selected);
      }
    } catch (err) {
      setLinkError(err.message);
    }
  };

  const validateLinkedFolder = async (folderPath) => {
    setValidating(true);
    setLinkValidation(null);
    try {
      const result = await window.pullmateApi?.repositories?.validateFolder(folderPath);
      setLinkValidation(result);
    } catch (err) {
      setLinkError(err.message);
    } finally {
      setValidating(false);
    }
  };

  const handleExecuteClone = async () => {
    if (!parentDir || !currentRepo) return;
    setCloning(true);
    setCloneError(null);
    setCloneProgress('Initiating git clone...');

    try {
      // Use cloneUrl directly without injecting credentials into command
      const targetUrl = currentRepo.cloneUrl || `https://github.com/${currentRepo.fullName}.git`;
      const result = await window.pullmateApi?.repositories?.clone(
        targetUrl,
        parentDir,
        currentRepo.name
      );

      // Add to tracked list
      const tracked = await window.pullmateApi?.repositories?.add({
        githubId: currentRepo.id,
        name: currentRepo.name,
        fullName: currentRepo.fullName,
        owner: currentRepo.owner,
        isPrivate: currentRepo.isPrivate,
        defaultBranch: currentRepo.defaultBranch,
        localPath: result.destinationPath
      });

      advanceNext(tracked);
    } catch (err) {
      setCloneError(err.message);
    } finally {
      setCloning(false);
    }
  };

  const handleExecuteLink = async () => {
    if (!linkedFolder || !currentRepo) return;
    if (!linkValidation?.isRepo) {
      setLinkError('Selected folder is not a valid Git repository.');
      return;
    }

    try {
      const tracked = await window.pullmateApi?.repositories?.add({
        githubId: currentRepo.id,
        name: currentRepo.name,
        fullName: currentRepo.fullName,
        owner: currentRepo.owner,
        isPrivate: currentRepo.isPrivate,
        defaultBranch: currentRepo.defaultBranch,
        localPath: linkedFolder
      });

      advanceNext(tracked);
    } catch (err) {
      setLinkError(err.message);
    }
  };

  const advanceNext = (trackedRepo = null) => {
    const updated = trackedRepo ? [...configuredRepos, trackedRepo] : configuredRepos;
    setConfiguredRepos(updated);

    if (currentIndex + 1 < selectedRepos.length) {
      setCurrentIndex(currentIndex + 1);
      // Reset form states for next repo
      setParentDir('');
      setLinkedFolder('');
      setLinkValidation(null);
      setCloneError(null);
      setLinkError(null);
      setCloneProgress('');
    } else {
      // All repositories processed
      onSetupComplete(updated);
    }
  };

  const handleSkip = () => {
    advanceNext(null);
  };

  if (!currentRepo) {
    return null;
  }

  const destinationPath = parentDir ? `${parentDir}\\${currentRepo.name}` : '';

  return (
    <div className="wizard-step-container">
      <div className="wizard-step-header">
        <div className="step-progress-counter">
          Repository {currentIndex + 1} of {selectedRepos.length}
        </div>
        <h2 className="step-title">Configure: {currentRepo.name}</h2>
        <p className="step-description">
          Choose whether to clone this repository to your machine or link an existing local folder.
        </p>
      </div>

      {/* Mode Switch Tabs */}
      <div className="dialog-mode-tabs">
        <button
          className={`dialog-mode-btn ${activeMode === 'clone' ? 'active' : ''}`}
          onClick={() => setActiveMode('clone')}
        >
          <Download size={15} />
          <span>Option A: Clone Repository</span>
        </button>
        <button
          className={`dialog-mode-btn ${activeMode === 'link' ? 'active' : ''}`}
          onClick={() => setActiveMode('link')}
        >
          <Link2 size={15} />
          <span>Option B: Link Existing Folder</span>
        </button>
      </div>

      {/* Mode Body */}
      <div className="dialog-mode-content">
        {activeMode === 'clone' ? (
          <div className="clone-form-section">
            <label className="input-label">Select Destination Folder</label>
            <div className="folder-input-row">
              <input
                type="text"
                readOnly
                placeholder="Choose parent folder (e.g. C:\Users\YourName\Projects)"
                value={parentDir}
                className="folder-path-input"
              />
              <button className="btn-browse" onClick={handleSelectParentDir} disabled={cloning}>
                <Folder size={14} /> Browse...
              </button>
            </div>

            {destinationPath && (
              <div className="destination-preview-box">
                <span className="preview-label">Will clone into:</span>
                <code className="preview-path">{destinationPath}</code>
              </div>
            )}

            {cloneProgress && (
              <div className="clone-progress-box">
                <RefreshCw size={14} className="spinning text-accent" />
                <span>{cloneProgress}</span>
              </div>
            )}

            {cloneError && (
              <div className="dialog-error-box">
                <AlertTriangle size={15} />
                <span>{cloneError}</span>
              </div>
            )}

            <div className="dialog-action-row">
              <button
                className="btn-primary-action"
                disabled={!parentDir || cloning}
                onClick={handleExecuteClone}
              >
                {cloning ? (
                  <>
                    <RefreshCw size={14} className="spinning" />
                    <span>Cloning Repository...</span>
                  </>
                ) : (
                  <>
                    <Download size={14} />
                    <span>Clone and Track</span>
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          <div className="link-form-section">
            <label className="input-label">Select Existing Local Git Repository</label>
            <div className="folder-input-row">
              <input
                type="text"
                readOnly
                placeholder="Select existing local folder (e.g. D:\work\my-project)"
                value={linkedFolder}
                className="folder-path-input"
              />
              <button className="btn-browse" onClick={handleSelectLinkFolder} disabled={validating}>
                <Folder size={14} /> Browse...
              </button>
            </div>

            {validating && (
              <div className="validating-box">
                <RefreshCw size={14} className="spinning" />
                <span>Inspecting Git metadata...</span>
              </div>
            )}

            {linkValidation && (
              <div className={`validation-result-box ${linkValidation.isRepo ? 'valid' : 'invalid'}`}>
                {linkValidation.isRepo ? (
                  <>
                    <CheckCircle2 size={16} className="text-success" />
                    <div>
                      <strong>Valid Git Repository Verified</strong>
                      <p>Root: <code>{linkValidation.rootPath}</code></p>
                    </div>
                  </>
                ) : (
                  <>
                    <AlertTriangle size={16} className="text-danger" />
                    <div>
                      <strong>Not a Git Repository</strong>
                      <p>{linkValidation.error || 'The selected folder does not contain a .git directory.'}</p>
                    </div>
                  </>
                )}
              </div>
            )}

            {linkError && (
              <div className="dialog-error-box">
                <AlertTriangle size={15} />
                <span>{linkError}</span>
              </div>
            )}

            <div className="dialog-action-row">
              <button
                className="btn-primary-action"
                disabled={!linkedFolder || validating || !linkValidation?.isRepo}
                onClick={handleExecuteLink}
              >
                <Link2 size={14} />
                <span>Link and Track</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Wizard Footer */}
      <div className="wizard-footer">
        <button
          className="btn-wizard-back"
          onClick={currentIndex > 0 ? () => setCurrentIndex(currentIndex - 1) : onBack}
          disabled={cloning}
        >
          Back
        </button>
        <button className="btn-skip-repo" onClick={handleSkip} disabled={cloning}>
          <SkipForward size={14} />
          <span>Skip This Repo for Now</span>
        </button>
      </div>
    </div>
  );
}
