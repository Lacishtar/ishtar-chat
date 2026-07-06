const path = require('path');
const { BrowserWindow } = require('electron');

const DEV_SERVER_URL = process.env.OVS_DASHBOARD_DEV_URL || 'http://localhost:5173';
const isDev = !!process.env.OVS_DEV;

function createMainWindow({ preloadPath, bounds }) {
  const win = new BrowserWindow({
    width: (bounds && bounds.width) || 1180,
    height: (bounds && bounds.height) || 760,
    minWidth: 900,
    minHeight: 600,
    backgroundColor: '#0E1013',
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isDev) {
    win.loadURL(DEV_SERVER_URL);
    win.webContents.openDevTools({ mode: 'detach' });
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist-dashboard', 'index.html'));
  }

  return win;
}

module.exports = { createMainWindow };
