export interface ElectronAPI {
  downloadResource: (url: string, targetPath: string) => Promise<{ success: boolean; error?: string }>;
  extractZip: (zipPath: string, targetDir: string) => Promise<{ success: boolean; error?: string }>;
  readFile: (filePath: string) => Promise<{ success: boolean; data?: string; error?: string }>;
  writeFile: (path: string, content: string) => Promise<{ success: boolean; error?: string }>;
  log: (message: string) => Promise<void>;
  listDir: (dirPath: string) => Promise<{ success: boolean; data?: string[]; error?: string }>;
  ensureDir: (dirPath: string) => Promise<{ success: boolean; error?: string }>;
  getUserDataPath: () => Promise<string>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
