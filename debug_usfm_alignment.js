const fs = require('fs');
const usfm = require('usfm-js');

// Mocking the parser logic from usfmParser.ts since I can't easily import it in a standalone script without compilation
// I'll copy the relevant parts
const extractWordsFromVerseObjects = (verseObjects, currentAlignment) => {
  if (!verseObjects) return [];
  
  let words = [];

  verseObjects.forEach(obj => {
    if (obj.type === 'word') {
      words.push({
        text: obj.text,
        alignment: currentAlignment
      });
    } else if (obj.type === 'text') {
       words.push({
         text: obj.text,
         alignment: currentAlignment
       });
    } else if (obj.type === 'milestone' && (obj.tag === 'zaln' || obj.tag === 'k')) {
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

const content = fs.readFileSync('/Users/birch/Library/Application Support/book-package-reader/resources/unfoldingWord/en_ult/en_ult/01-GEN.usfm', 'utf8');
const json = usfm.toJSON(content);

const chapter18 = json.chapters['18'];
if (chapter18) {
    const verse5 = chapter18['5'];
    if (verse5) {
        const words = extractWordsFromVerseObjects(verse5.verseObjects);
        console.log('Words in GEN 18:5:');
        words.forEach(w => {
            if (w.alignment) {
                console.log(`Word: "${w.text}", Content: "${w.alignment.content}", Occ: ${w.alignment.occurrence}`);
            }
        });
    } else {
        console.log('Verse 5 not found');
    }
} else {
    console.log('Chapter 18 not found');
}
