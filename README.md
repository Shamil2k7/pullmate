# PullMate 🌱
### Your Adorable GitHub-Connected Desktop Git Companion for Windows

PullMate is a production-minded Windows desktop application built with Electron and React. Rather than being a cold reminder or passive dashboard, PullMate features **Pip**, an animated desktop companion that remembers your repositories, automatically appears when Windows starts, checks Git synchronization status in the background, and communicates through friendly, helpful contextual messages.

---

## 🌟 Key Features

- **Cute Desktop Companion (Pip):**
  - Transparent, frameless, draggable, always-on-top floating desktop window.
  - Expressive state animations: Idle (blinking), Greeting (waving), Checking (scanning), Updates Available (alert), Up to Date (celebrating), Unsaved Changes (warning), Error (offline fallback), and Sleeping (gentle zZz during quiet hours).
  - Quick speech bubble with one-click actions: Pull Changes, Open Folder, Open Dashboard, Snooze, Hide.
- **Safe Synchronization Engine:**
  - Fast-forward only (`git pull --ff-only`) to protect your working branches.
  - Blocks pulls whenever uncommitted local changes exist to prevent merge conflicts.
  - Compares local HEAD with remote tracking branches using safe argument arrays (no shell interpolation).
  - Explicit user confirmation required before any pull operation. Never merges on a timer.
- **First-Time Onboarding Wizard:**
  - 6-step guided setup with Pip.
  - Official GitHub Device Authorization Flow (RFC 8628).
  - Repository selector with pagination and search.
  - Clone from GitHub or link existing local folders.
  - Custom reminder preferences.
- **Enterprise-Grade Credential Security:**
  - Passwords and personal access tokens are **never** pasted into UI or stored in plaintext.
  - Stored securely using **Windows Data Protection API (DPAPI)** via Electron's native `safeStorage`.
  - Credentials are never exposed to the React renderer (`contextIsolation: true`, `nodeIntegration: false`).
- **Windows Native Integration:**
  - Single-instance lock.
  - Windows login startup (`app.setLoginItemSettings`).
  - System Tray icon with quick actions (Check All, Show/Hide Pip, Snooze, Settings, Quit).
  - Native Windows notifications with deduplication and quiet hours.
  - Wake-from-sleep automatic sync checking via `powerMonitor`.

---

## 📋 System Prerequisites

- **Operating System:** Windows 10 or Windows 11 (64-bit).
- **Node.js:** v18.0.0 or later (tested on Node v24.13.0).
- **Git CLI:** Git version 2.25+ installed and available in Windows PATH.
- **GitHub Account:** (Free or Enterprise).

---

## 🚀 Quick Start & Development

### 1. Clone & Install Dependencies
```bash
git clone https://github.com/your-username/pullmate.git
cd pullmate
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
copy .env.example .env
```

To enable GitHub Device Flow:
1. Go to [GitHub Developer Settings > OAuth Apps](https://github.com/settings/developers).
2. Click **New OAuth App**.
   - **Application Name:** `PullMate`
   - **Homepage URL:** `https://github.com`
   - **Authorization callback URL:** `https://github.com`
3. Click **Register Application**.
4. Under the application settings, make sure **Enable Device Flow** is checked.
5. Copy the **Client ID** into your `.env` file:
   ```env
   GITHUB_CLIENT_ID=your_client_id_here
   DEFAULT_CHECK_INTERVAL_MINUTES=30
   ```
*(Note: PullMate also allows entering or overriding the Client ID directly in the Onboarding and Settings UI!)*

### 3. Run in Development Mode
Starts Vite dev server and launches Electron concurrently:
```bash
npm run dev
```

---

## 🧪 Testing

Run the automated test suite powered by Vitest:
```bash
npm test
```
The test suite validates:
- Git URL parser (HTTPS, SSH, git://, and malformed inputs).
- Working tree cleanliness checks and safe-pull blocking on uncommitted changes.
- Settings persistence and defaults recovery.
- Repository tracking, deduplication, and non-destructive removal.
- DPAPI secure token encryption and storage.
- Reminder scheduler snooze and quiet hours calculations.

---

## 📦 Building & Packaging the Windows Installer

### Build React Frontend:
```bash
npm run build:react
```

### Build Unpacked Windows Executable:
```bash
npm run build:electron
```
Outputs to `release/win-unpacked/PullMate.exe`.

### Generate Production NSIS Installer:
```bash
npm run dist
```
Generates a complete, installable `PullMate-Setup-1.0.0.exe` in the `release/` folder with Desktop and Start Menu shortcuts.

---

## 🛡️ Security Architecture

| Security Layer | Implementation |
|---|---|
| **Process Isolation** | `contextIsolation: true`, `nodeIntegration: false`, `sandbox: false` (secure preload bridge). |
| **Credential Storage** | Windows DPAPI native encryption (`safeStorage.encryptString`), zero plain-text tokens on disk. |
| **Git Command Safety** | `child_process.execFile` with argument arrays. Zero shell interpolation or command concatenation. |
| **Network Boundaries** | Strict Content Security Policy (CSP). Only official GitHub APIs and local assets allowed. |
| **Destructive Actions** | Two-step user confirmation for pulls. Repository removal from app leaves all local files untouched. |

---

## 🔍 Troubleshooting

- **"Git not detected in PATH"**:
  Make sure Git is installed and `git --version` works in PowerShell. Restart PullMate after installing Git.
- **"Device code expired"**:
  GitHub one-time device verification codes expire after 15 minutes. Click "Authorize with GitHub" again to generate a fresh code.
- **Pip disappeared from screen**:
  Open the main dashboard > Settings > Desktop Companion > Click **Reset Position** to return Pip to the bottom-right corner. You can also right-click the system tray icon and click "Show Pip".
- **Completely removing credentials**:
  In PullMate, navigate to **Settings > GitHub Connection > Disconnect Account & Erase Token**. This completely removes the encrypted credential file from `%APPDATA%\PullMate`.

---

## 📄 License
MIT License. Crafted with care for developers who want a friendly companion by their side.
