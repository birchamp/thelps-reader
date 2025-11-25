import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  downloadResource: (url: string, targetPath: string) => ipcRenderer.invoke('download-resource', url, targetPath),
  extractZip: (zipPath: string, targetDir: string) => ipcRenderer.invoke('extract-zip', zipPath, targetDir),
  readFile: (filePath: string) => ipcRenderer.invoke('read-file', filePath),
  writeFile: (path: string, content: string) => ipcRenderer.invoke('write-file', path, content),
  log: (message: string) => ipcRenderer.invoke('log', message),
  listDir: (dirPath: string) => ipcRenderer.invoke('list-dir', dirPath),
  ensureDir: (dirPath: string) => ipcRenderer.invoke('ensure-dir', dirPath),
  getUserDataPath: () => ipcRenderer.invoke('get-user-data-path'),
});
