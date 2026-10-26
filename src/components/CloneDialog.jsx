import React, { useState, useEffect } from 'react';
import {
  Folder,
  Download,
  Link2,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  SkipForward,
  ArrowRight,
  Info
} from 'lucide-react';

export default function CloneDialog({ selectedRepos = [], onSetupComplete, onBack }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [configuredRepos, setConfiguredRepos] = useState([]);
  const [activeMode, setActiveMode] = useState('link'); // 'link' | 'clone' (default to link for existing repos)

  // Clone form state
  const [parentDir, setParentDir] = useState('');
  const [cloning, setCloning] = useState(false);
  const [cloneProgress, setCloneProgress] = useState('');
  const [cloneError, setCloneError] = useState(null);

  // Link form state
  const [linkedFolder, setLinkedFolder] = useState('');
  const [validating, setValidating] = useState(false);
  const [linkValidation, setLinkValidation] = useState(null);
  const [linkError, setLinkError] = useState(null);

  // Standalone mode state (when no repos selected from GitHub)
  const [standaloneCloneUrl, setStandaloneCloneUrl] = useState('');
  const [standaloneRepoName, setStandaloneRepoName] = useState('');

  const hasSelectedRepos = Array.isArray(selectedRepos) && selectedRepos.length > 0;
  const currentRepo = hasSelectedRepos ? selectedRepos[currentIndex] : null;

  // Real-time validation when folder path is typed/pasted
  const handleFolderPathChange = (val) => {
    // Strip wrapping quotes (e.g. from Windows "Copy as path")
    const clean = val.replace(/^["']|["']$/g, '').trim();
    setLinkedFolder(clean);
    setLinkError(null);
    if (clean.length > 2) {
      validateLinkedFolder(clean);
    } else {
      setLinkValidation(null);
    }
  };

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
    if (!folderPath) return;
    setValidating(true);
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
    const targetUrl = currentRepo
      ? (currentRepo.cloneUrl || `https://github.com/${currentRepo.fullName}.git`)
      : standaloneCloneUrl.trim();

    const folderName = currentRepo
      ? currentRepo.name
      : (standaloneRepoName.trim() || targetUrl.split('/').pop().replace('.git', ''));

    if (!parentDir || !targetUrl || !folderName) return;

    setCloning(true);
    setCloneError(null);
    setCloneProgress('Initiating git clone...');

    try {
      const result = await window.pullmateApi?.repositories?.clone(
        targetUrl,
        parentDir,
        folderName
      );

      const tracked = await window.pullmateApi?.repositories?.add({
        githubId: currentRepo?.id || null,
        name: folderName,
        fullName: currentRepo?.fullName || folderName,
        owner: currentRepo?.owner || '',
        isPrivate: Boolean(currentRepo?.isPrivate),
        defaultBranch: currentRepo?.defaultBranch || 'main',
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
    if (!linkedFolder) return;
    if (!linkValidation?.isRepo) {
      setLinkError('Selected folder is not a valid Git repository (.git not found).');
      return;
    }

    try {
      const repoName = currentRepo?.name || linkedFolder.split(/[\\/]/).pop();
      const tracked = await window.pullmateApi?.repositories?.add({
        githubId: currentRepo?.id || null,
        name: repoName,
        fullName: currentRepo?.fullName || repoName,
        owner: currentRepo?.owner || '',
        isPrivate: Boolean(currentRepo?.isPrivate),
        defaultBranch: currentRepo?.defaultBranch || 'main',
        localPath: linkedFolder
      });

      advanceNext(tracked);
    } catch (err) {
      if (err.message && err.message.includes('already being tracked')) {
        // If already tracked, advance gracefully
        advanceNext(null);
      } else {
        setLinkError(err.message);
      }
    }
  };

  const advanceNext = (trackedRepo = null) => {
    const updated = trackedRepo ? [...configuredRepos, trackedRepo] : configuredRepos;
    setConfiguredRepos(updated);

    if (hasSelectedRepos && currentIndex + 1 < selectedRepos.length) {
      setCurrentIndex(currentIndex + 1);
      // Reset form states for next repo
      setParentDir('');
      setLinkedFolder('');
      setLinkValidation(null);
      setCloneError(null);
      setLinkError(null);
      setCloneProgress('');
    } else {
      // Finished all selected repositories or in standalone mode
      onSetupComplete(updated);
    }
  };

  const handleSkipThis = () => {
    advanceNext(null);
  };

  const handleFinishNow = () => {
    onSetupComplete(configuredRepos);
  };

  // Remote URL mismatch check for Option B
  const isRemoteMismatch = Boolean(
    currentRepo &&
    linkValidation?.remoteIdentity &&
    linkValidation.remoteIdentity.fullName &&
    currentRepo.fullName &&
    linkValidation.remoteIdentity.fullName.toLowerCase() !== currentRepo.fullName.toLowerCase()
  );

  const destinationPath = parentDir && currentRepo ? `${parentDir}\\${currentRepo.name}` : '';

  // =========================================================================
  // VIEW A: If user skipped GitHub and has 0 selected repos
  // =========================================================================
  if (!hasSelectedRepos) {
    return (
      <div className="wizard-step-container">
        <div className="wizard-step-header">
          <h2 className="step-title">Track a Local Git Repository</h2>
          <p className="step-description">
            Choose an existing Git repository on your computer or clone one now. You can also skip this and add repositories anytime later.
          </p>
        </div>

        <div className="dialog-mode-tabs">
          <button
            className={`dialog-mode-btn ${activeMode === 'link' ? 'active' : ''}`}
            onClick={() => setActiveMode('link')}
          >
            <Link2 size={15} />
            <span>Link Local Git Folder</span>
          </button>
          <button
            className={`dialog-mode-btn ${activeMode === 'clone' ? 'active' : ''}`}
            onClick={() => setActiveMode('clone')}
          >
            <Download size={15} />
            <span>Clone Git URL</span>
          </button>
        </div>

        <div className="dialog-mode-content">
          {activeMode === 'link' ? (
            <div className="link-form-section">
              <label className="input-label">Local Git Repository Folder Path</label>
              <div className="folder-input-row">
                <input
                  type="text"
                  placeholder="Paste or type path (e.g. D:\Projects\MyRepo)"
                  value={linkedFolder}
                  onChange={(e) => handleFolderPathChange(e.target.value)}
                  className="folder-path-input"
                />
                <button type="button" className="btn-browse" onClick={handleSelectLinkFolder} disabled={validating}>
                  <Folder size={14} /> Browse...
                </button>
              </div>

              {validating && (
                <div className="validating-box">
                  <RefreshCw size={14} className="spinning text-accent" />
                  <span>Checking Git metadata...</span>
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
                        {linkValidation.remoteUrl && (
                          <p style={{ marginTop: '3px' }}>Remote: <code>{linkValidation.remoteUrl}</code></p>
                        )}
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
                  <span>Link and Track Repository</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="clone-form-section">
              <label className="input-label">Git Clone URL (HTTPS or SSH)</label>
              <input
                type="text"
                placeholder="https://github.com/owner/repository.git"
                value={standaloneCloneUrl}
                onChange={(e) => setStandaloneCloneUrl(e.target.value)}
                className="text-input"
              />

              <label className="input-label" style={{ marginTop: '10px' }}>Destination Folder</label>
              <div className="folder-input-row">
                <input
                  type="text"
                  placeholder="Select parent folder on your machine"
                  value={parentDir}
                  onChange={(e) => setParentDir(e.target.value)}
                  className="folder-path-input"
                />
                <button type="button" className="btn-browse" onClick={handleSelectParentDir} disabled={cloning}>
                  <Folder size={14} /> Browse...
                </button>
              </div>

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
                  disabled={!standaloneCloneUrl || !parentDir || cloning}
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
                      <span>Clone & Track</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="wizard-footer">
          <button className="btn-wizard-back" onClick={onBack}>
            Back
          </button>
          <div className="wizard-footer-right">
            <button className="btn-skip-repo" onClick={handleFinishNow}>
              <span>Skip repository setup (set up later)</span>
              <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // VIEW B: Guided walkthrough for selected GitHub repositories
  // =========================================================================
  return (
    <div className="wizard-step-container">
      <div className="wizard-step-header">
        <div className="step-progress-counter">
          Repository {currentIndex + 1} of {selectedRepos.length}
        </div>
        <h2 className="step-title">Configure: {currentRepo.name}</h2>
        <p className="step-description">
          Choose whether to link an existing local folder or clone this repository to your machine.
        </p>
      </div>

      {/* Mode Switch Tabs */}
      <div className="dialog-mode-tabs">
        <button
          className={`dialog-mode-btn ${activeMode === 'link' ? 'active' : ''}`}
          onClick={() => setActiveMode('link')}
        >
          <Link2 size={15} />
          <span>Option A: Link Existing Folder</span>
        </button>
        <button
          className={`dialog-mode-btn ${activeMode === 'clone' ? 'active' : ''}`}
          onClick={() => setActiveMode('clone')}
        >
          <Download size={15} />
          <span>Option B: Clone Repository</span>
        </button>
      </div>

      {/* Mode Body */}
      <div className="dialog-mode-content">
        {activeMode === 'link' ? (
          <div className="link-form-section">
            <label className="input-label">Local Git Repository Folder Path</label>
            <div className="folder-input-row">
              <input
                type="text"
                placeholder="Paste or browse local folder (e.g. D:\Projects\MyRepo)"
                value={linkedFolder}
                onChange={(e) => handleFolderPathChange(e.target.value)}
                className="folder-path-input"
              />
              <button type="button" className="btn-browse" onClick={handleSelectLinkFolder} disabled={validating}>
                <Folder size={14} /> Browse...
              </button>
            </div>

            {validating && (
              <div className="validating-box">
                <RefreshCw size={14} className="spinning text-accent" />
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
                      {linkValidation.remoteUrl && (
                        <p style={{ marginTop: '2px' }}>Origin: <code>{linkValidation.remoteUrl}</code></p>
                      )}
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

            {isRemoteMismatch && (
              <div className="modal-warning-box" style={{ marginTop: '10px' }}>
                <Info size={16} />
                <div>
                  <strong>Remote Identity Warning</strong>
                  <p>
                    Local remote points to <code>{linkValidation.remoteIdentity?.fullName || linkValidation.remoteUrl}</code>,
                    while GitHub repo is <code>{currentRepo.fullName}</code>. You can still link and track it safely.
                  </p>
                </div>
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
                <span>Link & Track "{currentRepo.name}"</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="clone-form-section">
            <label className="input-label">Destination Parent Directory</label>
            <div className="folder-input-row">
              <input
                type="text"
                placeholder="Choose parent folder (e.g. C:\Users\YourName\Projects)"
                value={parentDir}
                onChange={(e) => setParentDir(e.target.value.replace(/^["']|["']$/g, '').trim())}
                className="folder-path-input"
              />
              <button type="button" className="btn-browse" onClick={handleSelectParentDir} disabled={cloning}>
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
                    <span>Clone & Track "{currentRepo.name}"</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Wizard Footer Controls */}
      <div className="wizard-footer">
        <button
          className="btn-wizard-back"
          onClick={currentIndex > 0 ? () => setCurrentIndex(currentIndex - 1) : onBack}
          disabled={cloning}
        >
          Back
        </button>

        <div className="wizard-footer-right">
          <button className="btn-skip-repo" onClick={handleSkipThis} disabled={cloning}>
            <SkipForward size={14} />
            <span>Skip this repository</span>
          </button>
          <button className="btn-wizard-next" onClick={handleFinishNow} disabled={cloning}>
            <span>Continue to Preferences</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
