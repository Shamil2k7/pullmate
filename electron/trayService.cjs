const { Tray, Menu, nativeImage, app } = require('electron');

class TrayService {
  constructor({ onOpenDashboard, onCheckAll, onToggleCharacter, onSnooze, onOpenSettings, onQuit, getCharacterVisibility }) {
    this.onOpenDashboard = onOpenDashboard;
    this.onCheckAll = onCheckAll;
    this.onToggleCharacter = onToggleCharacter;
    this.onSnooze = onSnooze;
    this.onOpenSettings = onOpenSettings;
    this.onQuit = onQuit;
    this.getCharacterVisibility = getCharacterVisibility || (() => true);

    this.tray = null;
  }

  /**
   * Creates a crisp default icon data URL for the tray
   */
  _createDefaultIcon() {
    // 24x24 cute round mascot / git sync node icon
    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" fill="#2E7D32"/>
        <circle cx="9" cy="10" r="2.2" fill="#FFFFFF"/>
        <circle cx="15" cy="10" r="2.2" fill="#FFFFFF"/>
        <path d="M8 15 C10 17, 14 17, 16 15" stroke="#FFFFFF" stroke-width="2" stroke-linecap="round"/>
      </svg>
    `.trim();

    return nativeImage.createFromDataURL(`data:image/svg+xml;utf8,${encodeURIComponent(svg)}`);
  }

  init() {
    if (this.tray) return;

    const icon = this._createDefaultIcon();
    this.tray = new Tray(icon);
    this.tray.setToolTip('PullMate - Your Git Buddy');

    this.tray.on('double-click', () => {
      this.onOpenDashboard();
    });

    this.updateContextMenu();
  }

  updateContextMenu() {
    if (!this.tray) return;

    const isCharVisible = this.getCharacterVisibility();

    const contextMenu = Menu.buildFromTemplate([
      {
        label: 'Open PullMate',
        click: () => this.onOpenDashboard()
      },
      {
        label: 'Check All Repositories',
        click: () => this.onCheckAll()
      },
      { type: 'separator' },
      {
        label: isCharVisible ? 'Hide Pip' : 'Show Pip',
        click: () => this.onToggleCharacter()
      },
      {
        label: 'Snooze Reminders',
        submenu: [
          { label: 'Snooze for 1 hour', click: () => this.onSnooze(1) },
          { label: 'Snooze for 2 hours', click: () => this.onSnooze(2) },
          { label: 'Snooze for 4 hours', click: () => this.onSnooze(4) },
          { type: 'separator' },
          { label: 'Disable Snooze', click: () => this.onSnooze(0) }
        ]
      },
      {
        label: 'Settings',
        click: () => this.onOpenSettings()
      },
      { type: 'separator' },
      {
        label: 'Quit PullMate',
        click: () => this.onQuit()
      }
    ]);

    this.tray.setContextMenu(contextMenu);
  }

  destroy() {
    if (this.tray) {
      this.tray.destroy();
      this.tray = null;
    }
  }
}

module.exports = TrayService;
