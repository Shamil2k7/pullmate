# PullMate Manual Test Plan & QA Checklist

This document details the complete end-to-end manual verification procedure for **PullMate** across all phases of desktop operation on Windows 10/11.

---

## 1. First-Run & Onboarding Flow

- [ ] **TC-01: Welcome Screen**
  - Launch PullMate on a clean environment (no `userData/settings.json`).
  - Verify logo, mascot "Pip" waving animation, and "Get Started" button appear cleanly.
  - Click "Get Started" to navigate to Screen 2.

- [ ] **TC-02: GitHub Device Flow Initiation**
  - Verify explanation of why access is needed and read-only scope guarantee.
  - Click "Authorize with GitHub".
  - Verify a single-use 8-character user code appears (e.g. `WDJB-MJHT`).
  - Verify "Copy Code" button copies code to Windows clipboard.
  - Click "Open GitHub Verification Page" and confirm browser opens `https://github.com/login/device`.
  - Enter code on GitHub, approve application, and verify PullMate automatically detects approval and advances to Screen 3.

- [ ] **TC-03: Authorization Cancellation & Expiration**
  - Click "Back" or cancel during authorization.
  - Verify polling stops immediately and no background network requests persist.
  - Verify expired code message is handled gracefully with a "Retry" option.

- [ ] **TC-04: Repository Selection & Pagination**
  - Verify accessible public and private repositories are fetched and displayed.
  - Type in search input to filter repositories by name.
  - Test "Select All" and "Deselect All" controls.
  - Test pagination controls ("Next Page" and "Previous Page").
  - Click "Continue to Local Setup".

- [ ] **TC-05: Clone Repository (Option A)**
  - Choose a selected repository.
  - Click "Browse" to choose destination parent folder.
  - Verify destination preview path matches expected folder.
  - Click "Clone and Track".
  - Verify Git progress updates live, folder is cloned, and repository is added to PullMate.
  - Verify that attempting to clone into an existing folder is prevented with a clear error.

- [ ] **TC-06: Link Existing Repository (Option B)**
  - Click "Browse" and choose an existing local Git directory on your computer.
  - Verify PullMate inspects `.git`, validates work tree, and shows green confirmation.
  - Select an invalid non-git directory (e.g. empty folder or Downloads).
  - Verify descriptive error: "Not a Git repository (.git not found)".
  - Click "Link and Track".

- [ ] **TC-07: Reminder Preferences Configuration**
  - Toggle "Launch on Windows Startup".
  - Toggle "Show Desktop Companion (Pip)".
  - Set background check frequency (e.g. 15m, 30m, 1h, 2h).
  - Enable "Quiet Hours" and set time window (e.g. 22:00 to 08:00).
  - Read "How PullMate Works" note explaining fetch vs pull.

- [ ] **TC-08: Setup Completion & Persistence**
  - Verify Screen 6 shows celebrating Pip with confetti: "All set! I'll keep an eye on your repositories."
  - Click "Finish Setup & Open Dashboard".
  - Close and relaunch PullMate.
  - Verify onboarding is NOT displayed again; app opens directly to the Dashboard.

---

## 2. Desktop Companion Character (Pip)

- [ ] **TC-09: Draggable Frameless Window**
  - Click and drag Pip across the desktop.
  - Verify position persists across restarts in `settings.json`.
  - Verify Pip stays within visible screen bounds and respects multi-monitor setups.

- [ ] **TC-10: State Reactions & Contextual Speech Bubble**
  - **Idle State:** Subtle floating motion and natural eye blinks.
  - **Checking State:** Blue/cyan antenna orb, scanning eyes, "Checking for Git updates...".
  - **Updates Available State:** Amber antenna orb, bounce alert, "X commits behind. Want to pull?".
  - **Up to Date State:** Green antenna orb, smiling curved eyes, "All repositories are synchronized!".
  - **Unsaved Changes State:** Orange antenna orb, cautionary message about protecting work.
  - **Sleeping State:** Dimmed slate orb, closed eyes, floating `zZz` during quiet hours or snooze.
  - **Celebrating State:** Purple/pink orb, confetti sparkles after a successful pull.

- [ ] **TC-11: Companion Controls**
  - Double-click Pip or click the open icon in speech bubble to focus main window.
  - Click "Hide Pip" to hide the companion window.
  - Go to Settings > Desktop Companion > Click "Reset Position" to restore Pip.

---

## 3. Git Operations & Safe Synchronization

- [ ] **TC-12: Background Fetch & Status Audit**
  - Click "Check All" in topbar.
  - Verify status badges update to "Up to date", "Behind remote", or "Ahead of remote".
  - Verify incoming/outgoing commit counts match `git rev-list --left-right --count HEAD...@{upstream}`.

- [ ] **TC-13: Safe Fast-Forward Pull Confirmation**
  - For a repository marked as "Behind", click "Pull Changes".
  - Verify confirmation modal appears stating branch names.
  - Confirm pull.
  - Verify changes are integrated using fast-forward only (`git pull --ff-only`).
  - Verify Pip enters celebrating state: "Pulled latest changes! You are synchronized."

- [ ] **TC-14: Uncommitted Changes Protection**
  - Modify a tracked file locally in a repository without committing (`git status` shows modified).
  - Click "Pull Changes".
  - Verify PullMate warns about uncommitted changes and prevents accidental merge conflicts.

- [ ] **TC-15: Non-Destructive Repository Untrack**
  - In Dashboard or Repositories page, click the Trash icon to untrack a repository.
  - Verify modal states: "Your local repository folder and files will not be deleted."
  - Confirm untrack.
  - Verify repository is removed from PullMate list, but folder and all files remain intact on disk.

---

## 4. Windows Native Features & System Tray

- [ ] **TC-16: System Tray Menu**
  - Verify PullMate tray icon appears in Windows Notification Area.
  - Double-click tray icon to restore main dashboard.
  - Right-click tray icon to verify menu:
    - Open PullMate
    - Check All Repositories
    - Show / Hide Pip
    - Snooze Reminders (1h, 2h, 4h, Disable)
    - Settings
    - Quit PullMate
  - Close main window with "Minimize to Tray" enabled; verify application remains running in tray.

- [ ] **TC-17: Native Windows Notifications & Deduplication**
  - Allow a repository to fall behind.
  - Verify native Windows toast notification appears with repository name.
  - Click notification to open PullMate.
  - Wait for next check cycle; verify duplicate notification is suppressed unless commit count increases or cooldown passes.

- [ ] **TC-18: Snooze & Quiet Hours**
  - Click "Snooze for 1 hour" from tray or Settings.
  - Verify notifications are silenced and Pip shows sleeping state.
  - Click "Clear Snooze" to resume normal alerts.

---

## 5. Security & Credential Teardown

- [ ] **TC-19: Token Encryption Verification**
  - Inspect `%APPDATA%\PullMate` or local storage directory.
  - Verify credentials file is encrypted with Windows DPAPI (`auth_credential.enc`), not plain JSON.
  - Verify React developer console does not expose any GitHub auth tokens.

- [ ] **TC-20: Disconnect & Clean Teardown**
  - In Settings, click "Disconnect Account & Erase Token".
  - Verify token file is deleted from disk.
  - Verify GitHub profile is cleared and app returns to unauthenticated state safely.
