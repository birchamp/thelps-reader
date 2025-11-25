import usfmjs from 'usfm-js';

export interface Word {
  text: string;
  alignment?: {
    strong?: string;
    lemma?: string;
    morph?: string;
    occurrence?: string;
    occurrences?: string;
    content?: string;
  };
}

export interface Verse {
  chapter: string;
  verse: string;
  words: Word[];
  text: string; // Keep for backward compatibility/simple display
}

export interface Chapter {
  chapter: string;
  verses: Verse[];
}

export const parseUsfm = (usfmContent: string): Record<string, any> => {
  return usfmjs.toJSON(usfmContent);
};

const extractWordsFromVerseObjects = (verseObjects: any[], currentAlignment?: any): Word[] => {
  if (!verseObjects) return [];
  
  let words: Word[] = [];

  verseObjects.forEach(obj => {
    if (obj.type === 'word') {
      words.push({
        text: obj.text,
        alignment: currentAlignment
      });
    } else if (obj.type === 'text') {
       // Regular text (punctuation, spaces) usually doesn't have alignment, 
       // but if it's inside a zaln, it might technically be part of the phrase.
       // For now, treat as plain text.
       words.push({
         text: obj.text,
         alignment: currentAlignment
       });
    } else if (obj.type === 'milestone' && (obj.tag === 'zaln' || obj.tag === 'k')) {
      // Extract alignment data
      const alignment = {
        strong: obj.strong,
        lemma: obj.lemma,
        morph: obj.morph,
        occurrence: obj.occurrence,
        occurrences: obj.occurrences,
        content: obj.content
      };
      
      if (obj.children) {
        words = words.concat(extractWordsFromVerseObjects(obj.children, alignment));
      }
    } else if (obj.children) {
      words = words.concat(extractWordsFromVerseObjects(obj.children, currentAlignment));
    }
  });

  return words;
};

export const extractChapters = (usfmJson: Record<string, any>): Chapter[] => {
  const chapters: Chapter[] = [];
  
  if (!usfmJson || !usfmJson.chapters) {
    return chapters;
  }

  Object.keys(usfmJson.chapters).forEach(chapterNum => {
    const chapterData = usfmJson.chapters[chapterNum];
    const verses: Verse[] = [];

    Object.keys(chapterData).forEach(verseNum => {
      const verseData = chapterData[verseNum];
      
      let words: Word[] = [];
      if (verseData.verseObjects) {
        words = extractWordsFromVerseObjects(verseData.verseObjects);
      }

      verses.push({
        chapter: chapterNum,
        verse: verseNum,
        words: words,
        text: words.map(w => w.text).join('')
      });
    });

    // Sort verses numerically
    verses.sort((a, b) => parseInt(a.verse) - parseInt(b.verse));

    chapters.push({
      chapter: chapterNum,
      verses: verses
    });
  });

  // Sort chapters numerically
  chapters.sort((a, b) => parseInt(a.chapter) - parseInt(b.chapter));

  return chapters;
};
