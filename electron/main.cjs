const { app, BrowserWindow, shell, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow = null;
let serverInstance = null;
const SERVER_PORT = parseInt(process.env.PORT || '3001', 10);

// 1. Diagnostics & File Logger
function getLogFilePath() {
  try {
    return path.join(app.getPath('userData'), 'smartcut.log');
  } catch (e) {
    return path.join(__dirname, '..', 'smartcut.log');
  }
}

function appLog(...args) {
  const line = `[${new Date().toISOString()}] ${args.map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')}\n`;
  console.log(...args);
  try {
    fs.appendFileSync(getLogFilePath(), line, 'utf8');
  } catch (e) {}
}

// Global exception safety nets
process.on('uncaughtException', (err) => {
  appLog('❌ [Electron] Uncaught Exception:', err?.stack || err);
});
process.on('unhandledRejection', (reason) => {
  appLog('❌ [Electron] Unhandled Rejection:', reason?.stack || reason);
});

// 2. Single Instance Lock (منع فتح نسختين من البرنامج في نفس الوقت لتفادي تضارب المنفذ وقاعدة البيانات)
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  appLog('[Electron] Another instance is already running. Quitting.');
  app.quit();
  process.exit(0);
}

app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// 3. Setup Environment & Configuration
function setupEnvironment() {
  const isPackaged = app.isPackaged;
  const userDataPath = app.getPath('userData');

  // Writable user data folder for uploads, backups, and local libSQL database
  const userUploadsDir = path.join(userDataPath, 'uploads');
  if (!fs.existsSync(userUploadsDir)) {
    try { fs.mkdirSync(userUploadsDir, { recursive: true }); } catch (e) {}
  }

  const userBackupsDir = path.join(userDataPath, 'backups');
  if (!fs.existsSync(userBackupsDir)) {
    try { fs.mkdirSync(userBackupsDir, { recursive: true }); } catch (e) {}
  }

  // Resolved dist path for frontend
  let distPath = isPackaged
    ? path.join(process.resourcesPath, 'app.asar.unpacked', 'dist')
    : path.join(__dirname, '..', 'dist');
  if (isPackaged && !fs.existsSync(distPath)) {
    distPath = path.join(process.resourcesPath, 'dist');
  }
  if (!fs.existsSync(distPath)) {
    distPath = path.join(__dirname, '..', 'dist');
  }

  const defaultDbPath = isPackaged
    ? path.join(userDataPath, 'smartcut.db')
    : path.join(__dirname, '..', 'smartcut.db');

  process.env.SMARTCUT_UPLOADS_DIR = userUploadsDir;
  process.env.SMARTCUT_BACKUPS_DIR = userBackupsDir;
  process.env.SMARTCUT_DIST_DIR = distPath;
  process.env.SMARTCUT_CONFIG_DIR = userDataPath;
  process.env.SMARTCUT_USER_DATA_DIR = userDataPath;
  process.env.PORT = String(SERVER_PORT);
  if (!process.env.DATABASE_URL) {
    process.env.DATABASE_URL = `file:${defaultDbPath}`;
  }

  // Load .env configuration
  const envCandidates = [
    path.join(userDataPath, '.env'),
    path.join(process.resourcesPath, '.env'),
    path.join(__dirname, '..', '.env')
  ];

  for (const ep of envCandidates) {
    if (fs.existsSync(ep)) {
      try {
        const content = fs.readFileSync(ep, 'utf8');
        content.split(/\r?\n/).forEach(line => {
          const trimmed = line.trim();
          if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
            const idx = trimmed.indexOf('=');
            const k = trimmed.slice(0, idx).trim();
            const v = trimmed.slice(idx + 1).trim();
            if (!process.env[k]) {
              process.env[k] = v;
            }
          }
        });
        // Copy to userData on first run if not exists
        const userEnv = path.join(userDataPath, '.env');
        if (!fs.existsSync(userEnv)) {
          try { fs.writeFileSync(userEnv, content, 'utf8'); } catch (e) {}
        }
        break;
      } catch (e) {}
    }
  }

  appLog('[Electron] Environment setup complete.');
  appLog(`[Electron] Database URL: ${process.env.DATABASE_URL}`);
  appLog(`[Electron] Dist directory: ${distPath}`);
  appLog(`[Electron] User uploads directory: ${userUploadsDir}`);
  appLog(`[Electron] User backups directory: ${userBackupsDir}`);
}

// Helper to check and free port 3001 if occupied by an orphaned process
async function ensurePortAvailable(port) {
  const net = require('net');
  return new Promise((resolve) => {
    const tester = net.createServer()
      .once('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          appLog(`⚠️ Port ${port} is occupied. Attempting to terminate orphaned background processes...`);
          try {
            if (process.platform === 'win32') {
              const { execSync } = require('child_process');
              const out = execSync(`netstat -ano | findstr :${port} | findstr LISTENING`, { encoding: 'utf8' });
              const lines = out.trim().split(/\r?\n/);
              for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                const pid = parseInt(parts[parts.length - 1], 10);
                if (pid && pid !== process.pid) {
                  appLog(`[Electron] Killing orphaned listener on port ${port} (PID: ${pid})...`);
                  try { execSync(`taskkill /F /PID ${pid}`, { stdio: 'ignore' }); } catch (e) {}
                }
              }
            }
          } catch (e) {
            appLog('[Electron] Note during port cleanup:', e.message);
          }
        }
        resolve();
      })
      .once('listening', () => {
        tester.close(() => resolve());
      })
      .listen(port, '127.0.0.1');
  });
}

// 4. Start In-Process Backend Service (سيرفر داخلي متصل بـ libSQL و WebSockets)
async function startBackendService() {
  const remoteServer = process.env.SERVER_URL || process.env.SMARTCUT_SERVER_URL;
  if (remoteServer && remoteServer.startsWith('http')) {
    appLog(`🌐 [Electron] Running in Client Mode, connecting to remote server: ${remoteServer}`);
    return;
  }

  try {
    await ensurePortAvailable(SERVER_PORT);
    appLog('🔌 [Electron] Starting in-process libSQL + WebSockets backend service...');
    // Resolve and load server_libsql.cjs from bundled app or unpacked directory
    const candidates = [
      path.resolve(__dirname, '..', 'server_libsql.cjs'),
      path.join(process.resourcesPath, 'app.asar.unpacked', 'server_libsql.cjs'),
      path.join(process.resourcesPath, 'server_libsql.cjs'),
      path.join(__dirname, '..', '..', 'server_libsql.cjs')
    ];
    let serverScriptPath = candidates.find(p => fs.existsSync(p)) || candidates[0];
    appLog(`[Electron] Loading backend module from: ${serverScriptPath}`);
    const backend = require(serverScriptPath);
    if (typeof backend.startServer === 'function') {
      serverInstance = await backend.startServer(SERVER_PORT);
    }
    appLog(`✅ [Electron] Backend service is live on port ${SERVER_PORT}!`);
  } catch (err) {
    appLog('❌ [Electron] Backend service startup notice:', err.message);
    if (err.code === 'EADDRINUSE') {
      appLog(`⚠️ Port ${SERVER_PORT} is already bound. Existing service will be used.`);
    }
  }
}

// 5. Create Desktop Application Window
function createMainWindow() {
  const iconCandidates = [
    path.join(process.resourcesPath, 'public', 'icon.ico'),
    path.join(process.resourcesPath, 'icon.ico'),
    path.join(__dirname, '..', 'public', 'icon.ico'),
    path.join(__dirname, '..', 'public', 'favicon.ico')
  ];
  const iconPath = iconCandidates.find(p => fs.existsSync(p)) || undefined;

  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    minWidth: 1024,
    minHeight: 700,
    title: 'Smart Cut POS - نظام إدارة الصالونات والمراكز',
    icon: iconPath,
    backgroundColor: '#020617', // slate-950
    autoHideMenuBar: true, // إخفاء شريط القوائم التقليدي لإعطاء مظهر تطبيق سطح مكتب حديث
    show: false, // يظهر فقط عند اكتمال الرسم لتفادي أي وميض أو شاشة بيضاء
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false,
      contextIsolation: true,
      spellcheck: false
    }
  });

  // إظهار وتكبير النافذة فور جاهزيتها
  mainWindow.once('ready-to-show', () => {
    mainWindow.maximize();
    mainWindow.show();
    appLog('✨ [Electron] Main window is ready and displayed.');
  });

  // احتياطي أمان: إظهار النافذة بعد ثانيتين إذا لم تطلق ready-to-show
  setTimeout(() => {
    if (mainWindow && !mainWindow.isDestroyed() && !mainWindow.isVisible()) {
      mainWindow.maximize();
      mainWindow.show();
      appLog('✨ [Electron] Main window displayed via fallback timer.');
    }
  }, 2000);

  // تسجيل كافة رسائل وأخطاء واجهة المستخدم داخل سجل smartcut.log
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    appLog(`🖥️ [Renderer Console][level ${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.on('did-finish-load', () => {
    appLog('✅ [Electron] UI loaded successfully into window.');
  });

  mainWindow.webContents.on('render-process-gone', (event, details) => {
    appLog('❌ [Electron] Renderer process gone:', JSON.stringify(details));
  });

  // Load production local server or configured LAN server with auto-retry
  const remoteServer = process.env.SERVER_URL || process.env.SMARTCUT_SERVER_URL;
  const targetUrl = (remoteServer && remoteServer.startsWith('http'))
    ? remoteServer.replace(/\/+$/, '')
    : `http://localhost:${SERVER_PORT}`;
  appLog(`🌐 [Electron] Loading desktop UI from: ${targetUrl}`);

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    appLog(`⚠️ [Electron] Page failed to load (${errorCode}: ${errorDescription}). Retrying in 1s...`);
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.loadURL(targetUrl);
      }
    }, 1000);
  });

  mainWindow.loadURL(targetUrl);

  // Handle external links safely
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https://wa.me') || url.startsWith('http://wa.me') || url.startsWith('mailto:')) {
      shell.openExternal(url);
      return { action: 'deny' };
    }
    return { action: 'allow' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// 6. Direct / Silent Thermal Printing Handler (بدون أي نوافذ حوارية أو معاينة)
ipcMain.handle('print-silent', async (event, { html, deviceName }) => {
  return new Promise((resolve) => {
    try {
      const printWin = new BrowserWindow({
        show: false,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true
        }
      });

      const fullHtml = `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>طباعة الفاتورة</title>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page { size: 80mm auto; margin: 0; }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Cairo', sans-serif; }
    body { width: 72mm; margin: 0 auto; padding: 2mm; background: #fff; color: #000; direction: rtl; }
    @media print { body { width: 72mm; margin: 0 auto; padding: 0; } }
  </style>
</head>
<body>
  ${html}
</body>
</html>`;

      printWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(fullHtml)}`);

      printWin.webContents.on('did-finish-load', () => {
        printWin.webContents.print(
          {
            silent: true,
            printBackground: true,
            deviceName: deviceName || undefined
          },
          (success, failureReason) => {
            printWin.close();
            if (!success) {
              appLog('[Electron] Silent print failed:', failureReason);
              resolve({ success: false, error: failureReason });
            } else {
              appLog('[Electron] Silent print succeeded.');
              resolve({ success: true });
            }
          }
        );
      });
    } catch (err) {
      appLog('[Electron] Error during silent print:', err.message);
      resolve({ success: false, error: err.message });
    }
  });
});

// 7. Application Lifecycle
app.whenReady().then(async () => {
  appLog('🚀 [Electron] App ready.');
  setupEnvironment();
  await startBackendService();
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('before-quit', () => {
  appLog('👋 [Electron] Closing application...');
  if (serverInstance) {
    try {
      serverInstance.close();
    } catch (e) {}
    serverInstance = null;
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
