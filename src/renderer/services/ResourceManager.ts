import axios from 'axios';
import Papa from 'papaparse';

const API_BASE = 'https://git.door43.org/api/v1';

export interface Resource {
  id: number;
  name: string;
  full_name: string;
  owner: {
    login: string;
  };
  description: string;
  language: string;
  subject: string;
  title: string;
  zipball_url: string;
  stage: string;
  release_tag?: string;
}

const REQUIRED_RESOURCES = [
  { owner: 'unfoldingWord', repo: 'en_ust' },
  { owner: 'unfoldingWord', repo: 'en_ult' },
  { owner: 'unfoldingWord', repo: 'en_tn' },
  { owner: 'unfoldingWord', repo: 'en_twl' },
  { owner: 'unfoldingWord', repo: 'en_tq' },
  { owner: 'unfoldingWord', repo: 'en_tw' },
  { owner: 'unfoldingWord', repo: 'en_ta' },
  { owner: 'Worldview', repo: 'en_bsb' },
];

export class ResourceManager {
  private userDataPath: string = '';

  async initialize() {
    this.userDataPath = await window.electronAPI.getUserDataPath();
  }

  async syncResources(onProgress: (message: string) => void): Promise<void> {
    if (!this.userDataPath) await this.initialize();

    for (const req of REQUIRED_RESOURCES) {
      try {
        onProgress(`Checking ${req.repo}...`);
        const release = await this.getLatestRelease(req.owner, req.repo);
        if (!release) {
            console.warn(`No release found for ${req.owner}/${req.repo}`);
            continue;
        }

        const resourceDir = `${this.userDataPath}/resources/${req.owner}/${req.repo}`;
        const versionFile = `${resourceDir}/version.txt`;
        
        // Check if we already have this version
        let currentVersion = '';
        try {
            const result = await window.electronAPI.readFile(versionFile);
            if (result.success && result.data) {
                currentVersion = result.data.trim();
            }
        } catch (e) {
            // Ignore error, file might not exist
        }

        if (currentVersion === release.tag_name) {
            console.log(`${req.repo} is up to date (${currentVersion})`);
            continue;
        }

        onProgress(`Downloading ${req.repo} ${release.tag_name}...`);
        const zipPath = `${resourceDir}.zip`;
        
        // Ensure directory exists
        await window.electronAPI.ensureDir(`${this.userDataPath}/resources/${req.owner}`);

        // Download
        const downloadResult = await window.electronAPI.downloadResource(release.zipball_url, zipPath);
        if (!downloadResult.success) {
            throw new Error(downloadResult.error);
        }

        // Extract
        onProgress(`Extracting ${req.repo}...`);
        const extractResult = await window.electronAPI.extractZip(zipPath, resourceDir);
        if (!extractResult.success) {
            throw new Error(extractResult.error);
        }

        // Write version file
        await window.electronAPI.writeFile(versionFile, release.tag_name);
        
        console.log(`Updated ${req.repo} to ${release.tag_name}`);

      } catch (error) {
        console.error(`Error syncing ${req.repo}:`, error);
        onProgress(`Failed to sync ${req.repo}`);
      }
    }
    onProgress('Sync complete');
  }

  async getLatestRelease(owner: string, repo: string): Promise<any> {
      try {
          const response = await axios.get(`${API_BASE}/repos/${owner}/${repo}/releases/latest`);
          return response.data;
      } catch (error) {
          console.error(`Error fetching release for ${owner}/${repo}`, error);
          return null;
      }
  }

  async getLocalResources(): Promise<string[]> {
    if (!this.userDataPath) await this.initialize();
    // TODO: Implement proper scanning
    return [];
  }
  
  // Keep searchResources for now if needed, or remove if unused.
  async searchResources(query: string = '', language: string = 'en', subject?: string): Promise<Resource[]> {
      // Placeholder to satisfy interface if needed, or just return empty
      return Promise.resolve([]);
  }
  
  // Keep downloadResource for compatibility or remove
  async downloadResource(resource: Resource): Promise<boolean> {
      return Promise.resolve(false);
  }
  async getAvailableBooks(owner: string, repo: string): Promise<string[]> {
    if (!this.userDataPath) await this.initialize();
    const resourceDir = `${this.userDataPath}/resources/${owner}/${repo}`;
    try {
      const result = await window.electronAPI.listDir(resourceDir);
      if (result.success && result.data) {
        
        // Handle potential subdirectory from zip extraction
        let files = result.data;
        
        // Filter out non-content files
        const potentialDirs = result.data.filter(f => !f.endsWith('.txt') && !f.endsWith('.json') && !f.startsWith('.'));
        
        if (potentialDirs.length === 1) {
             const subDir = potentialDirs[0];
             // Try to list it to see if it's a directory
             const subDirPath = `${resourceDir}/${subDir}`;
             const subResult = await window.electronAPI.listDir(subDirPath);
             
             if (subResult.success && subResult.data && subResult.data.length > 0) {
                 // Prepend subdirectory to filenames so getBookContent can find them
                 files = subResult.data.map(f => `${subDir}/${f}`);
             }
        }

        const books = files.filter(f => f.endsWith('.usfm')).sort();
        return books;
      }
    } catch (e) {
      console.error(`Error listing books for ${repo}`, e);
    }
    return [];
  }

  async getBookContent(owner: string, repo: string, filename: string): Promise<string> {
    if (!this.userDataPath) await this.initialize();
    const filePath = `${this.userDataPath}/resources/${owner}/${repo}/${filename}`;
    try {
      const result = await window.electronAPI.readFile(filePath);
      if (result.success && result.data) {
        return result.data;
      }
    } catch (e) {
      console.error(`Error reading book ${filename}`, e);
    }
    return '';
  }

  async getTranslationNotes(owner: string, repo: string, bookId: string): Promise<any[]> {
    if (!this.userDataPath) await this.initialize();
    
    // Construct path: resources/owner/repo/repo/tn_BOOKID.tsv
    // Note: The repo name is repeated in the path structure we've seen
    const tsvFilename = `tn_${bookId.toUpperCase()}.tsv`;
    const resourcePath = `${this.userDataPath}/resources/${owner}/${repo}/${repo}/${tsvFilename}`;
    
    try {
        const result = await window.electronAPI.readFile(resourcePath);
        if (!result.success || !result.data) {
            console.error(`Failed to read TN file: ${result.error}`);
            return [];
        }
        return new Promise((resolve, reject) => {
            Papa.parse(result.data!, {
                header: true,
                delimiter: '\t', // Explicitly specify tab delimiter
                skipEmptyLines: true,
                complete: (results: any) => {
                    const mappedData = results.data.map((row: any) => {
                        // Row should have keys matching headers: Reference, ID, Tags, SupportReference, Quote, Occurrence, Note
                        if (!row.Reference) return null;
                        
                        const [chapter, verse] = row.Reference.split(':');
                        
                        return {
                            Chapter: chapter,
                            Verse: verse,
                            ID: row.ID,
                            SupportReference: row.SupportReference,
                            OrigQuote: row.Quote,
                            Occurrence: row.Occurrence,
                            OccurrenceNote: row.Note ? row.Note.replace(/\\n/g, '\n') : '',
                            GLQuote: '' // Not present in these files
                        };
                    }).filter((item: any) => item !== null);
                    
                    resolve(mappedData);
                },
                error: (error: any) => {
                    reject(error);
                }
            });
        });
    } catch (e) {
        console.error(`Error reading TN file: ${resourcePath}`, e);
        return [];
    }
  }

  async getTranslationWordsList(owner: string, repo: string, bookId: string): Promise<any[]> {
    if (!this.userDataPath) await this.initialize();
    
    const tsvFilename = `twl_${bookId.toUpperCase()}.tsv`;
    const resourcePath = `${this.userDataPath}/resources/${owner}/${repo}/${repo}/${tsvFilename}`;
    
    try {
        const result = await window.electronAPI.readFile(resourcePath);
        if (!result.success || !result.data) {
            console.error(`Failed to read TWL file: ${result.error}`);
            return [];
        }
        return new Promise((resolve, reject) => {
            Papa.parse(result.data!, {
                header: true,
                delimiter: '\t',
                skipEmptyLines: true,
                complete: (results: any) => {
                    const mappedData = results.data.map((row: any) => {
                        if (!row.Reference) return null;
                        
                        const [chapter, verse] = row.Reference.split(':');
                        
                        return {
                            Chapter: chapter,
                            Verse: verse,
                            ID: row.ID,
                            Tags: row.Tags,
                            OrigWords: row.OrigWords,
                            Occurrence: row.Occurrence,
                            TWLink: row.TWLink
                        };
                    }).filter((item: any) => item !== null);
                    
                    resolve(mappedData);
                },
                error: (error: any) => {
                    reject(error);
                }
            });
        });
    } catch (e) {
        console.error(`Error reading TWL file: ${resourcePath}`, e);
        return [];
    }
  }

  async getTranslationQuestions(owner: string, repo: string, bookId: string): Promise<any[]> {
    if (!this.userDataPath) await this.initialize();
    
    const fileName = `tq_${bookId.toUpperCase()}.tsv`;
    const resourcePath = `${this.userDataPath}/resources/${owner}/${repo}/${repo}/${fileName}`;
    
    try {
        const result = await window.electronAPI.readFile(resourcePath);
        if (!result.success || !result.data) {
            console.warn(`No tQ file found for ${bookId}`);
            return [];
        }

        return new Promise((resolve, reject) => {
            Papa.parse(result.data!, {
                header: true,
                delimiter: '\t',
                skipEmptyLines: true,
                complete: (results: any) => {
                    const mappedData = results.data.map((row: any) => {
                        if (!row.Reference) return null;
                        
                        const [chapter, verse] = row.Reference.split(':');
                        
                        return {
                            Chapter: chapter,
                            Verse: verse,
                            ID: row.ID,
                            Tags: row.Tags,
                            Quote: row.Quote,
                            Occurrence: row.Occurrence,
                            Question: row.Question,
                            Response: row.Response
                        };
                    }).filter((item: any) => item !== null);
                    
                    resolve(mappedData);
                },
                error: (error: any) => {
                    reject(error);
                }
            });
        });
    } catch (e) {
        console.error(`Error reading tQ file: ${resourcePath}`, e);
        return [];
    }
  }

  async getTranslationWord(owner: string, repo: string, twLink: string): Promise<string> {
    if (!this.userDataPath) await this.initialize();
    
    // Parse TWLink: rc://*/tw/dict/bible/kt/god -> bible/kt/god.md
    const match = twLink.match(/\/dict\/(.+)$/);
    if (!match) {
        console.error(`Invalid TWLink format: ${twLink}`);
        return '';
    }
    
    const relativePath = match[1] + '.md';
    const filePath = `${this.userDataPath}/resources/${owner}/${repo}/${repo}/${relativePath}`;
    
    try {
        const result = await window.electronAPI.readFile(filePath);
        if (result.success && result.data) {
            return result.data;
        }
    } catch (e) {
        console.error(`Error reading TW file: ${filePath}`, e);
    }
    return '';
  }

  async getTranslationAcademy(owner: string, repo: string, link: string): Promise<string> {
      if (!this.userDataPath) await this.initialize();
      
      // Link format: rc://*/ta/man/translate/figs-activepassive
      // We need to extract: translate/figs-activepassive
      
      const match = link.match(/rc:\/\/.*\/ta\/man\/(.+)/);
      if (!match) {
          console.warn(`Invalid tA link format: ${link}`);
          return '';
      }
      
      const pathPart = match[1]; // e.g., translate/figs-activepassive
      // Construct path: resources/owner/repo/repo/pathPart/01.md
      // Note: repo is usually 'en_ta'
      
      const filePath = `${this.userDataPath}/resources/${owner}/${repo}/${repo}/${pathPart}/01.md`;
      
      try {
          const result = await window.electronAPI.readFile(filePath);
          if (result.success && result.data) {
              return result.data;
          }
      } catch (e) {
          console.error(`Error reading tA file: ${filePath}`, e);
      }
      return '';
  }

  async getTAContent(owner: string, repo: string, relativePath: string): Promise<string> {
      if (!this.userDataPath) await this.initialize();
      
      // relativePath is like: translate/figs-metaphor/01.md
      const filePath = `${this.userDataPath}/resources/${owner}/${repo}/${repo}/${relativePath}`;
      
      try {
          const result = await window.electronAPI.readFile(filePath);
          if (result.success && result.data) {
              return result.data;
          }
      } catch (e) {
          console.error(`Error reading tA file: ${filePath}`, e);
      }
      return '';
  }

  async getTATitle(owner: string, repo: string, relativePath: string): Promise<string> {
      if (!this.userDataPath) await this.initialize();
      
      // relativePath is like: translate/figs-metaphor/01.md
      // We need to replace the filename with title.md
      const dirPath = relativePath.substring(0, relativePath.lastIndexOf('/'));
      const filePath = `${this.userDataPath}/resources/${owner}/${repo}/${repo}/${dirPath}/title.md`;
      
      try {
          const result = await window.electronAPI.readFile(filePath);
          if (result.success && result.data) {
              return result.data.trim();
          }
      } catch (e) {
          // title.md might not exist, or error reading it
          console.warn(`Error reading tA title file: ${filePath}`, e);
      }
      return 'Translation Academy'; // Fallback title
  }
}

export const resourceManager = new ResourceManager();
