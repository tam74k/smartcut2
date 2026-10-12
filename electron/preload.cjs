const { contextBridge, ipcRenderer } = require('electron');

// Expose safe desktop environment flags and APIs to renderer
contextBridge.exposeInMainWorld('desktopAPI', {
  isDesktop: true,
  platform: process.platform,
  version: '1.0.0',
  printSilent: (params) => ipcRenderer.invoke('print-silent', params)
});
