const { app, BrowserWindow } = require('electron');
const path = require('path');
const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1300,
    height: 900,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:3000');
    win.webContents.openDevTools();
  } else {
    win.loadURL('http://localhost:3000');
  }
}

app.whenReady().then(() => {
  // start Next.js server when app launches in production
  if (!isDev) {
    const { spawn } = require('child_process');
    const server = spawn('node', [
      path.join(__dirname, '.next/standalone/apps/mentor/server.js'),
    ]);

    server.stdout.on('data', (d) => console.log('[server]', d.toString()));
    server.stderr.on('data', (d) =>
      console.error('[server error]', d.toString()),
    );
  }

  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
