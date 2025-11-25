import { useState, useEffect, useCallback, useRef } from 'react';
import { resourceManager } from '../services/ResourceManager';
import { parseUsfm, extractChapters, type Chapter } from '../utils/usfmParser';
import { PDFExportModal } from './PDFExportModal';
import './ScriptureReader.css';
import ReactMarkdown from 'react-markdown';

interface ScriptureReaderProps {
  initialBook?: string;
  initialChapter?: string;
}

export const ScriptureReader = ({ initialBook, initialChapter }: ScriptureReaderProps) => {
  const [books, setBooks] = useState<string[]>([]);
  // Initialize from localStorage or props or default
  const [selectedBook, setSelectedBook] = useState<string>(() => {
    return initialBook || localStorage.getItem('lastBook') || '';
  });
  const [chapters, setChapters] = useState<Chapter[]>([]);
  const [currentChapter, setCurrentChapter] = useState<Chapter | null>(null);
  const currentChapterRef = useRef<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTranslation, setActiveTranslation] = useState<'ULT' | 'BSB'>('ULT');

  const loadBooks = useCallback(async () => {
    // Defaulting to en_ult for now
    const bookList = await resourceManager.getAvailableBooks('unfoldingWord', 'en_ult');
    setBooks(bookList);
    return bookList;
  }, []);

  const [translationNotes, setTranslationNotes] = useState<any[]>([]);
  const [translationWordsList, setTranslationWordsList] = useState<any[]>([]);
  const [translationQuestions, setTranslationQuestions] = useState<any[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'notes' | 'words' | 'questions'>('notes');
  const [activeWordId, setActiveWordId] = useState<string | null>(null);
  const [activeWordDefinition, setActiveWordDefinition] = useState<string>('');
  
  // TA Modal state
  const [taHistory, setTaHistory] = useState<{path: string, content: string, title: string, scrollPosition: number}[]>([]);
  const [currentTAIndex, setCurrentTAIndex] = useState(-1);
  const [isTAModalOpen, setIsTAModalOpen] = useState(false);
  
  // Resizer state
  const [sidebarWidth, setSidebarWidth] = useState(400);
  const [isResizing, setIsResizing] = useState(false);

  const startResizing = useCallback(() => {
    setIsResizing(true);
    document.body.classList.add('resizing');
  }, []);

  const stopResizing = useCallback(() => {
    setIsResizing(false);
    document.body.classList.remove('resizing');
  }, []);

  const resize = useCallback((mouseMoveEvent: MouseEvent) => {
    if (isResizing) {
      const newWidth = document.body.clientWidth - mouseMoveEvent.clientX;
      if (newWidth > 200 && newWidth < 800) { // Min and max constraints
          setSidebarWidth(newWidth);
      }
    }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener("mousemove", resize);
    window.addEventListener("mouseup", stopResizing);
    return () => {
      window.removeEventListener("mousemove", resize);
      window.removeEventListener("mouseup", stopResizing);
    };
  }, [resize, stopResizing]);

  // Keep ref in sync with state
  useEffect(() => {
      if (currentChapter) {
          currentChapterRef.current = currentChapter.chapter;
      }
  }, [currentChapter]);


  const loadBookContent = useCallback(async (bookFilename: string, translation: 'ULT' | 'BSB' = activeTranslation) => {
    setLoading(true);
    
    let owner = 'unfoldingWord';
    let repo = 'en_ult';
    let adjustedFilename = bookFilename;
    
    // Extract the base filename (e.g. 43-JHN.usfm)
    const baseFilename = bookFilename.split('/').pop() || bookFilename;

    if (translation === 'BSB') {
        owner = 'Worldview';
        repo = 'en_bsb';
        // BSB is in en_bsb subdirectory
        adjustedFilename = `en_bsb/${baseFilename}`;
    } else {
        // ULT is in en_ult subdirectory
        adjustedFilename = `en_ult/${baseFilename}`;
    }
    
    const content = await resourceManager.getBookContent(owner, repo, adjustedFilename);
    const json = parseUsfm(content);
    const extractedChapters = extractChapters(json);
    setChapters(extractedChapters);
    
    // Load Translation Notes and Translation Words List
    const bookId = bookFilename.split('-')[1].replace('.usfm', '').toLowerCase();
    const notes = await resourceManager.getTranslationNotes('unfoldingWord', 'en_tn', bookId);
    setTranslationNotes(notes);
    
    const twl = await resourceManager.getTranslationWordsList('unfoldingWord', 'en_twl', bookId);
    setTranslationWordsList(twl);
    
    const tq = await resourceManager.getTranslationQuestions('unfoldingWord', 'en_tq', bookId);
    setTranslationQuestions(tq);

    if (extractedChapters.length > 0) {
        // Determine target target: initial -> saved -> default (3 for John) -> 1
        // If we are switching translations, we want to stay on the current chapter if possible
        let targetChapterNum = currentChapterRef.current || initialChapter || localStorage.getItem('lastChapter');
        
        // If we are defaulting to John and have no saved chapter, default to 3
        if (!targetChapterNum && bookFilename.includes('43-JHN')) {
            targetChapterNum = '3';
        }

        const targetChapter = targetChapterNum
            ? extractedChapters.find(c => c.chapter === targetChapterNum) 
            : extractedChapters[0];
            
        const finalChapter = targetChapter || extractedChapters[0];
        setCurrentChapter(finalChapter);
        // Save initial load state
        localStorage.setItem('lastChapter', finalChapter.chapter);
    }
    setLoading(false);
  }, [initialChapter, activeTranslation]);

  // Initial load of books
  useEffect(() => {
    let mounted = true;
    const init = async () => {
        const bookList = await loadBooks();
        if (mounted && bookList.length > 0 && !selectedBook) {
            const defaultBookName = '43-JHN.usfm';
            const foundBook = bookList.find(b => b.endsWith(defaultBookName));
            if (foundBook) {
                setSelectedBook(foundBook);
            } else {
                setSelectedBook(bookList[0]);
            }
        }
    };
    init();
    return () => { mounted = false; };
  }, [loadBooks]); // selectedBook is intentionally omitted to run only on mount/loadBooks change

  // Load content when selectedBook changes
  useEffect(() => {
    if (selectedBook) {
      localStorage.setItem('lastBook', selectedBook);
      loadBookContent(selectedBook);
    }
  }, [selectedBook, loadBookContent]);

  const handleChapterChange = useCallback((chapterNum: string) => {
      const chapter = chapters.find(c => c.chapter === chapterNum);
      if (chapter) {
          setCurrentChapter(chapter);
          localStorage.setItem('lastChapter', chapterNum);
      }
  }, [chapters]);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  // Helper to get book name from filename
  const getBookName = (filename: string) => filename.split('/').pop()?.replace('.usfm', '').replace(/^\d+-/, '') || filename;

  const handleNextChapter = () => {
      if (!currentChapter || !chapters.length) return;
      const currentIndex = chapters.findIndex(c => c.chapter === currentChapter.chapter);
      if (currentIndex < chapters.length - 1) {
          handleChapterChange(chapters[currentIndex + 1].chapter);
      }
  };

  const handlePrevChapter = () => {
      if (!currentChapter || !chapters.length) return;
      const currentIndex = chapters.findIndex(c => c.chapter === currentChapter.chapter);
      if (currentIndex > 0) {
          handleChapterChange(chapters[currentIndex - 1].chapter);
      }
  };

  const handleTranslationChange = (translation: 'ULT' | 'BSB') => {
      if (translation === activeTranslation) return;
      setActiveTranslation(translation);
      if (selectedBook) {
          loadBookContent(selectedBook, translation);
      }
  };

  const [activeVerse, setActiveVerse] = useState<string | null>(null);

  const navigateToReference = useCallback((chapterNum: string, verseNum: string) => {
      // 1. Change chapter if needed
      if (currentChapterRef.current !== chapterNum) {
          handleChapterChange(chapterNum);
          // We need to wait for the chapter to load before scrolling
          // This is a bit tricky with the current setup, but since handleChapterChange is synchronous for state update
          // and the render happens after, we can try to scroll in a useEffect or timeout
          // For now, let's just set the active verse which will highlight it
      }
      
      // 2. Set active verse (this highlights it)
      setActiveVerse(verseNum);
      
      // 3. Scroll into view
      // We use a small timeout to allow for render if chapter changed
      setTimeout(() => {
          const verseElement = document.querySelector(`[data-verse="${verseNum}"]`);
          if (verseElement) {
              verseElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
      }, 100);
  }, [handleChapterChange, currentChapterRef]);

  // Custom Link Renderer for ReactMarkdown
  const LinkRenderer = (props: any) => {
      return (
          <a 
              href={props.href} 
              onClick={(e) => {
                  // Check for scripture links: ../01/01.md
                  const match = props.href?.match(/\.\.\/(\d+)\/(\d+)\.md/);
                  if (match) {
                      e.preventDefault();
                      const [, chapter, verse] = match;
                      navigateToReference(parseInt(chapter).toString(), parseInt(verse).toString());
                  } else if (props.href?.startsWith('rc://')) {
                      // Handle RC links if needed, or let them be handled by other logic
                      // For now, we'll just prevent default to avoid navigation
                      e.preventDefault();
                  }
              }}
          >
              {props.children}
          </a>
      );
  };

  // Filter notes for current chapter
  const currentChapterNotes = translationNotes.filter(note => 
      String(note.Chapter) === String(currentChapter?.chapter)
  );

  // Filter TWL for current chapter
  const currentChapterWords = translationWordsList.filter(word => 
      String(word.Chapter) === String(currentChapter?.chapter)
  );

  // Filter notes for active verse if selected
  const displayedNotes = activeVerse 
      ? currentChapterNotes.filter(note => String(note.Verse) === activeVerse)
      : currentChapterNotes;

  // Filter TWL for active verse if selected  
  const displayedWords = activeVerse
      ? currentChapterWords.filter(word => String(word.Verse) === activeVerse)
      : currentChapterWords;

  // Filter questions for current chapter
  const currentChapterQuestions = translationQuestions.filter(q =>
      String(q.Chapter) === String(currentChapter?.chapter)
  );

  // Filter questions for active verse if selected
  const displayedQuestions = activeVerse
      ? currentChapterQuestions.filter(q => String(q.Verse) === activeVerse)
      : currentChapterQuestions;


  // Helper to check if a word matches a note's quote
  const getNoteForWord = (word: any, verseNum: string) => {
      if (!word.alignment || !word.alignment.content) return null;
      
      return currentChapterNotes.find(note => {
          if (String(note.Verse) !== verseNum) return false;
          
          // Normalize quotes using uw-quote-helpers logic (simplified)
          // We don't have the full library loaded in the browser easily without configuration, 
          // so we'll implement robust cleaning here inspired by it.
          // Actually, we installed it, so let's try to use it if the build system supports it.
          // But for safety, I'll implement a robust cleaner here.
          
          const clean = (s: string) => s.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
          
          const noteQuote = clean(note.OrigQuote || '');
          const wordQuote = clean(word.alignment.content || '');
          
          if (!noteQuote || !wordQuote) return false;

          // Exact match
          if (noteQuote === wordQuote) {
               // Check occurrence if available
              if (note.Occurrence && word.alignment.occurrence) {
                  return String(note.Occurrence) === String(word.alignment.occurrence);
              }
              return true;
          }
          
          // Phrase match: if the note quote contains the word quote (and word quote is significant)
          // This is tricky because of occurrences. 
          // If note is "A B", and word is "A".
          // If we match "A", we might match the wrong "A".
          // But usually TN `OrigQuote` matches the `zaln` content exactly OR `zaln` content is a subset.
          
          // If `zaln` content is "A B" (grouped), then it matches.
          // If `zaln` content is "A", and note is "A B".
          // We need to know if this "A" belongs to the "A B" phrase.
          // This requires full alignment context which we don't have easily here.
          
          // Fallback: if noteQuote contains wordQuote
          if (noteQuote.includes(wordQuote)) {
              // We ignore occurrence for partial matches as it's unreliable without full context
              return true;
          }
          
          return false;
      });
  };

  // Helper to get the English phrase for a note
  const getEnglishQuoteForNote = (note: any) => {
      if (!currentChapter) return note.GLQuote || note.OrigQuote;
      
      const clean = (s: string) => s.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
      const noteQuote = clean(note.OrigQuote || '');
      
      // Find all words in the verse that match this note
      const verse = currentChapter.verses.find(v => String(v.verse) === String(note.Verse));
      if (!verse) return note.GLQuote || note.OrigQuote;
      
      const matchingWords: string[] = [];
      verse.words.forEach(word => {
          if (!word.alignment || !word.alignment.content) return;
          
          const wordQuote = clean(word.alignment.content || '');
          if (!noteQuote || !wordQuote) return;
          
          // Check if this word matches the note
          let matches = false;
          if (noteQuote === wordQuote) {
              if (note.Occurrence && word.alignment.occurrence) {
                  matches = String(note.Occurrence) === String(word.alignment.occurrence);
              } else {
                  matches = true;
              }
          } else if (noteQuote.includes(wordQuote)) {
              matches = true;
          }
          
          if (matches && word.text) {
              matchingWords.push(word.text);
          }
      });
      
      return matchingWords.length > 0 ? matchingWords.join(' ').replace(/\s+/g, ' ').trim() : (note.GLQuote || note.OrigQuote);
  };

  // Helper to check if a word matches a specific note
  const doesWordMatchNote = (word: any, note: any, verseNum: string) => {
      if (!note || String(note.Verse) !== verseNum) return false;
      if (!word.alignment || !word.alignment.content) return false;
      
      const clean = (s: string) => s.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
      const noteQuote = clean(note.OrigQuote || '');
      const wordQuote = clean(word.alignment.content || '');
      
      if (!noteQuote || !wordQuote) return false;

      // Exact match
      if (noteQuote === wordQuote) {
          if (note.Occurrence && word.alignment.occurrence) {
              return String(note.Occurrence) === String(word.alignment.occurrence);
          }
          return true;
      }
      
      // Phrase match
      if (noteQuote.includes(wordQuote)) {
          return true;
      }
      
      return false;
  };

  // Helper to get the English phrase for a TW entry
  const getEnglishQuoteForWord = (twEntry: any) => {
      if (!currentChapter) return twEntry.OrigWords;
      
      const clean = (s: string) => s.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
      const origWords = clean(twEntry.OrigWords || '');
      
      const verse = currentChapter.verses.find(v => String(v.verse) === String(twEntry.Verse));
      if (!verse) return twEntry.OrigWords;
      
      const matchingWords: string[] = [];
      verse.words.forEach(word => {
          if (!word.alignment || !word.alignment.content) return;
          
          const wordQuote = clean(word.alignment.content || '');
          if (!origWords || !wordQuote) return;
          
          let matches = false;
          if (origWords === wordQuote) {
              if (twEntry.Occurrence && word.alignment.occurrence) {
                  matches = String(twEntry.Occurrence) === String(word.alignment.occurrence);
              } else {
                  matches = true;
              }
          } else if (origWords.includes(wordQuote)) {
              matches = true;
          }
          
          if (matches && word.text) {
              matchingWords.push(word.text);
          }
      });
      
      return matchingWords.length > 0 ? matchingWords.join(' ').replace(/\s+/g, ' ').trim() : twEntry.OrigWords;
  };

  const handleTWClick = async (twEntry: any) => {
      setActiveWordId(twEntry.ID);
      
      // Load TW definition
      const definition = await resourceManager.getTranslationWord('unfoldingWord', 'en_tw', twEntry.TWLink);
      setActiveWordDefinition(definition);
      
      // Scroll to verse
      const verseElement = document.querySelector(`.verse[data-verse="${twEntry.Verse}"]`);
      if (verseElement) {
          verseElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
  };




  const handleWordClick = (note: any) => {
      if (note) {
          setActiveNoteId(note.ID);
          const noteElement = document.getElementById(`note-${note.ID}`);
          if (noteElement) {
              noteElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
      }
  };

  const handleVerseClick = (verseNum: string) => {
      if (activeVerse === verseNum) {
          setActiveVerse(null); // Toggle off
      } else {
          setActiveVerse(verseNum);
          // Scroll notes to top when switching verses
          const notesList = document.querySelector('.notes-list');
          if (notesList) notesList.scrollTop = 0;
      }
  };

  const handleNoteClick = (note: any) => {
      setActiveNoteId(note.ID);
      
      // Scroll the verse into view in the scripture pane
      const verseElement = document.querySelector(`.verse[data-verse="${note.Verse}"]`);
      if (verseElement) {
          verseElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
  };

  const handleTAClick = async (e: React.MouseEvent, note: any) => {
      e.stopPropagation(); // Prevent note selection if we just want to read the article
      if (!note.SupportReference) return;
      
      const content = await resourceManager.getTranslationAcademy('unfoldingWord', 'en_ta', note.SupportReference);
      
      // Initial path from RC link: rc://*/ta/man/translate/figs-activepassive
      // We store the relative path part: translate/figs-activepassive/01.md
      const match = note.SupportReference.match(/rc:\/\/.*\/ta\/man\/(.+)/);
      const initialPath = match ? `${match[1]}/01.md` : '';
      
      const title = await resourceManager.getTATitle('unfoldingWord', 'en_ta', initialPath);

      setTaHistory([{ path: initialPath, content, title, scrollPosition: 0 }]);
      setCurrentTAIndex(0);
      setIsTAModalOpen(true);
  };

  const handleTALinkClick = async (href: string) => {
      // href is like: ../figs-metaphor/01.md
      // current path is like: translate/figs-activepassive/01.md
      
      if (!taHistory[currentTAIndex]) return;
      const currentPath = taHistory[currentTAIndex].path;
      
      // Save current scroll position before navigating
      const taContentElement = document.querySelector('.ta-content');
      const currentScrollPosition = taContentElement ? taContentElement.scrollTop : 0;
      
      // Update current history entry with scroll position
      const updatedHistory = [...taHistory];
      updatedHistory[currentTAIndex] = {
          ...updatedHistory[currentTAIndex],
          scrollPosition: currentScrollPosition
      };
      
      // Simple path resolution
      const currentDir = currentPath.substring(0, currentPath.lastIndexOf('/'));
      // We need to handle ../ and ./
      // This is a basic implementation, might need a proper path library or function
      
      const parts = currentDir.split('/');
      const relativeParts = href.split('/');
      
      for (const part of relativeParts) {
          if (part === '..') {
              parts.pop();
          } else if (part !== '.') {
              parts.push(part);
          }
      }
      
      const newPath = parts.join('/');
      
      const content = await resourceManager.getTAContent('unfoldingWord', 'en_ta', newPath);
      const title = await resourceManager.getTATitle('unfoldingWord', 'en_ta', newPath);
      
      if (content) {
          const newHistory = updatedHistory.slice(0, currentTAIndex + 1);
          newHistory.push({ path: newPath, content, title, scrollPosition: 0 });
          setTaHistory(newHistory);
          setCurrentTAIndex(newHistory.length - 1);
          
          // Scroll to top of new article
          setTimeout(() => {
              const taContentElement = document.querySelector('.ta-content');
              if (taContentElement) {
                  taContentElement.scrollTop = 0;
              }
          }, 0);
      }
  };

  const handleTABack = () => {
      if (currentTAIndex > 0) {
          setCurrentTAIndex(currentTAIndex - 1);
          
          // Restore scroll position after going back
          setTimeout(() => {
              const taContentElement = document.querySelector('.ta-content');
              const previousScrollPosition = taHistory[currentTAIndex - 1]?.scrollPosition || 0;
              if (taContentElement) {
                  taContentElement.scrollTop = previousScrollPosition;
              }
          }, 0);
      }
  };

  return (
    <div className="scripture-reader">
      {/* Top Navigation Bar */}
      <div className="top-bar">
        <div className="book-chapter-selector" onClick={() => setIsModalOpen(true)}>
          <span>{selectedBook ? getBookName(selectedBook) : 'Select Book'}</span>
          {currentChapter && <span> {currentChapter.chapter}</span>}
          <span style={{ fontSize: '0.8em', opacity: 0.6 }}>▼</span>
        </div>

        <button 
            className="nav-btn" 
            style={{ marginLeft: '1rem', marginRight: 'auto' }}
            onClick={() => setIsExportModalOpen(true)}
            disabled={!selectedBook}
        >
            Export PDF
        </button>

        <div className="nav-buttons">
            <button 
                className="nav-btn" 
                onClick={handlePrevChapter}
                disabled={!currentChapter || chapters.findIndex(c => c.chapter === currentChapter.chapter) <= 0}
            >
                &lt; Prev
            </button>
            <button 
                className="nav-btn" 
                onClick={handleNextChapter}
                disabled={!currentChapter || chapters.findIndex(c => c.chapter === currentChapter.chapter) >= chapters.length - 1}
            >
                Next &gt;
            </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="main-content-area">
        {/* Scripture Text */}
        <div className="content-container">
            <div className="scripture-tabs">
                <button 
                    className={`scripture-tab ${activeTranslation === 'ULT' ? 'active' : ''}`}
                    onClick={() => handleTranslationChange('ULT')}
                >
                    ULT
                </button>
                <button 
                    className={`scripture-tab ${activeTranslation === 'BSB' ? 'active' : ''}`}
                    onClick={() => handleTranslationChange('BSB')}
                >
                    BSB
                </button>
            </div>

            {loading ? (
                <div style={{ padding: '2rem', textAlign: 'center' }}>Loading...</div>
            ) : currentChapter ? (
                <div className="chapter-content">
                    <h2 className="chapter-title">Chapter {currentChapter.chapter}</h2>
                    {currentChapter.verses.map(v => (
                        <span key={v.verse} data-verse={v.verse} className={`verse ${activeVerse === v.verse ? 'active-verse' : ''}`}>
                            <sup 
                                className="verse-num" 
                                onClick={() => handleVerseClick(v.verse)}
                                title="Click to filter notes for this verse"
                            >
                                {v.verse}
                            </sup>
                            {v.words.map((word, idx) => {
                                const note = getNoteForWord(word, v.verse);
                                // Check if this word matches the active note (for overlapping quotes)
                                const activeNote = activeNoteId ? currentChapterNotes.find(n => n.ID === activeNoteId) : null;
                                const matchesActiveNote = activeNote ? doesWordMatchNote(word, activeNote, v.verse) : false;
                                
                                return (
                                    <span 
                                        key={idx} 
                                        className={`word ${note ? 'has-note' : ''} ${matchesActiveNote ? 'active-note' : ''}`}
                                        onClick={() => handleWordClick(note)}
                                        title={note ? 'Click to see note' : ''}
                                    >
                                        {word.text}
                                    </span>
                                );
                            })}
                            {/* Fallback for plain text if words are missing (shouldn't happen with new parser) */}
                            {v.words.length === 0 && <span className="verse-text">{v.text} </span>}
                        </span>
                    ))}
                </div>
            ) : (
                <div style={{ padding: '2rem', textAlign: 'center', color: '#888' }}>Select a book to start reading</div>
            )}
        </div>


        {/* Translation Helps Sidebar with Tabs */}
        <div className="resizer" onMouseDown={startResizing}></div>
        <div className="helps-sidebar" style={{ width: sidebarWidth }}>
            <div className="helps-tabs">
                <button 
                    className={`tab-btn ${activeTab === 'notes' ? 'active' : ''}`}
                    onClick={() => setActiveTab('notes')}
                >
                    Translation Notes
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'words' ? 'active' : ''}`}
                    onClick={() => setActiveTab('words')}
                >
                    Translation Words
                </button>
                <button 
                    className={`tab-btn ${activeTab === 'questions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('questions')}
                >
                    Translation Questions
                </button>
            </div>

            {activeTab === 'notes' ? (
                <>
                    <div className="notes-header-bar">
                        {activeVerse && (
                            <button className="clear-filter-btn" onClick={() => setActiveVerse(null)}>
                                Show All (Verse {activeVerse}) ✕
                            </button>
                        )}
                    </div>
                    {displayedNotes.length > 0 ? (
                        <div className="notes-list">
                            {displayedNotes.map((note, idx) => (
                                <div 
                                    key={idx} 
                                    id={`note-${note.ID}`}
                                    className={`note-card ${activeNoteId === note.ID ? 'active' : ''}`}
                                    onClick={() => handleNoteClick(note)}
                                >
                                    <div className="note-header">
                                        <span className="note-ref">{note.Chapter}:{note.Verse}</span>
                                        <span className="note-quote">{getEnglishQuoteForNote(note)}</span>
                                    </div>
                                    <div className="note-body">
                                        <ReactMarkdown 
                                            components={{
                                                a: LinkRenderer
                                            }}
                                        >
                                            {note.OccurrenceNote}
                                        </ReactMarkdown>
                                        {note.SupportReference && (
                                            <div className="note-actions">
                                                <button 
                                                    className="ta-link-btn"
                                                    onClick={(e) => handleTAClick(e, note)}
                                                >
                                                    📖 Read Article
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="no-notes">
                            {activeVerse 
                                ? `No notes for verse ${activeVerse}` 
                                : 'No notes for this chapter'}
                        </div>
                    )}
                </>
            ) : activeTab === 'words' ? (
                <>
                    <div className="notes-header-bar">
                        {activeVerse && (
                            <button className="clear-filter-btn" onClick={() => setActiveVerse(null)}>
                                Show All (Verse {activeVerse}) ✕
                            </button>
                        )}
                    </div>
                    {displayedWords.length > 0 ? (
                        <div className="notes-list">
                            {displayedWords.map((word, idx) => (
                                <div 
                                    key={idx}
                                    id={`tw-${word.ID}`}
                                    className={`note-card ${activeWordId === word.ID ? 'active' : ''}`}
                                    onClick={() => handleTWClick(word)}
                                >
                                    <div className="note-header">
                                        <span className="note-ref">{word.Chapter}:{word.Verse}</span>
                                        <span className="note-quote">{getEnglishQuoteForWord(word)}</span>
                                    </div>
                                    <div className="note-body">
                                        {activeWordId === word.ID && activeWordDefinition ? (
                                            <ReactMarkdown>{activeWordDefinition}</ReactMarkdown>
                                        ) : (
                                            <>
                                                <div className="tw-link">
                                                    {word.TWLink.split('/').pop()}
                                                </div>
                                                {word.Tags && <div className="tw-tags">{word.Tags}</div>}
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="no-notes">
                            {activeVerse 
                                ? `No translation words for verse ${activeVerse}` 
                                : 'No translation words for this chapter'}
                        </div>
                    )}
                </>
            ) : activeTab === 'questions' ? (
                <>
                    <div className="notes-header-bar">
                        {activeVerse && (
                            <button className="clear-filter-btn" onClick={() => setActiveVerse(null)}>
                                Show All (Verse {activeVerse}) ✕
                            </button>
                        )}
                    </div>
                    {displayedQuestions.length > 0 ? (
                        <div className="notes-list">
                            {displayedQuestions.map((question, idx) => (
                                <div 
                                    key={idx}
                                    className="note-card question-card"
                                >
                                    <div className="note-header">
                                        <span className="note-ref">{question.Chapter}:{question.Verse}</span>
                                        {question.Quote && <span className="note-quote">{question.Quote}</span>}
                                    </div>
                                    <div className="note-body">
                                        <div className="question-text">
                                            <strong>Q:</strong> {question.Question}
                                        </div>
                                        <div className="response-text">
                                            <strong>A:</strong> {question.Response}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="no-notes">
                            {activeVerse 
                                ? `No translation questions for verse ${activeVerse}` 
                                : 'No translation questions for this chapter'}
                        </div>
                    )}
                </>
            ) : null}
        </div>
      </div>

      <PDFExportModal 
        isOpen={isExportModalOpen} 
        onClose={() => setIsExportModalOpen(false)} 
        currentBook={selectedBook} 
      />

      {/* Selection Modal */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3>Select Scripture</h3>
                    <button className="close-btn" onClick={() => setIsModalOpen(false)}>×</button>
                </div>
                <div className="modal-body">
                    <div className="book-list">
                        {books.map(book => (
                            <div 
                                key={book} 
                                className={`book-item ${selectedBook === book ? 'selected' : ''}`}
                                onClick={() => setSelectedBook(book)}
                            >
                                {getBookName(book)}
                            </div>
                        ))}
                    </div>
                    <div className="chapter-grid">
                        {chapters.map(c => (
                            <div 
                                key={c.chapter} 
                                className={`chapter-item ${currentChapter?.chapter === c.chapter ? 'current' : ''}`}
                                onClick={() => {
                                    handleChapterChange(c.chapter);
                                    setIsModalOpen(false);
                                }}
                            >
                                {c.chapter}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* TA Content Modal */}
      {isTAModalOpen && (
        <div className="modal-overlay" onClick={() => setIsTAModalOpen(false)}>
            <div className="modal-content ta-modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        {currentTAIndex > 0 && (
                            <button className="back-btn" onClick={handleTABack}>
                                ← Back
                            </button>
                        )}
                        <h3>{taHistory[currentTAIndex]?.title || 'Translation Academy'}</h3>
                    </div>
                    <button className="close-btn" onClick={() => setIsTAModalOpen(false)}>×</button>
                </div>
                <div className="modal-body ta-content">
                    <ReactMarkdown
                        components={{
                            a: ({node, ...props}) => (
                                <a 
                                    {...props} 
                                    onClick={(e) => {
                                        e.preventDefault();
                                        if (props.href) handleTALinkClick(props.href);
                                    }} 
                                    style={{ cursor: 'pointer', color: '#1976d2' }}
                                />
                            )
                        }}
                    >
                        {taHistory[currentTAIndex]?.content || ''}
                    </ReactMarkdown>
                </div>
            </div>
        </div>
      )}
    </div>
  );
};
