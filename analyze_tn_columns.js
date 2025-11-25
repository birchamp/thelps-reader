const fs = require('fs');

function analyzeFile(filename) {
    console.log(`Analyzing ${filename}...`);
    const content = fs.readFileSync(filename, 'utf8');
    const lines = content.split('\n').slice(0, 5);
    lines.forEach((line, lineIdx) => {
        if (!line.trim()) return;
        const cols = line.split('\t');
        console.log(`Row ${lineIdx}: ${cols.length} columns`);
        cols.forEach((col, colIdx) => {
            console.log(`  [${colIdx}]: ${col.substring(0, 50)}...`);
        });
    });
}

analyzeFile('/Users/birch/Library/Application Support/book-package-reader/resources/unfoldingWord/en_tn/en_tn/tn_GEN.tsv');
console.log('---');
analyzeFile('/Users/birch/Library/Application Support/book-package-reader/resources/unfoldingWord/en_tn/en_tn/tn_EXO.tsv');
