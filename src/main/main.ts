import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import fs from 'fs-extra';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

const createWindow = () => {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // and load the index.html of the app.
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.

import axios from 'axios';
import AdmZip from 'adm-zip';

ipcMain.handle('download-resource', async (event, url: string, targetPath: string) => {
  try {
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'arraybuffer',
    });
    
    // Ensure directory exists
    await fs.ensureDir(path.dirname(targetPath));
    
    // Write file
    await fs.writeFile(targetPath, response.data);
    return { success: true };
  } catch (error) {
    console.error('Download error:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('extract-zip', async (event, zipPath: string, targetDir: string) => {
  try {
    const zip = new AdmZip(zipPath);
    zip.extractAllTo(targetDir, true);
    return { success: true };
  } catch (error) {
    console.error('Extract error:', error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('read-file', async (event, filePath: string) => {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { success: true, data: content };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('write-file', async (event, filePath: string, content: string) => {
  try {
    await fs.writeFile(filePath, content, 'utf-8');
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('list-dir', async (event, dirPath: string) => {
  try {
    const files = await fs.readdir(dirPath);
    return { success: true, data: files };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('ensure-dir', async (event, dirPath: string) => {
  try {
    await fs.ensureDir(dirPath);
    return { success: true };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle('log', (event, message: string) => {
  console.log('RENDERER:', message);
});

ipcMain.handle('get-user-data-path', () => {
  return app.getPath('userData');
});

