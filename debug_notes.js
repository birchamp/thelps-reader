const Papa = require('papaparse');
const fs = require('fs');

const content = fs.readFileSync('/Users/birch/Library/Application Support/book-package-reader/resources/unfoldingWord/en_tn/en_tn/tn_GEN.tsv', 'utf8');

Papa.parse(content, {
    header: true,
    delimiter: '\t', // Add explicit tab delimiter
    skipEmptyLines: true,
    complete: (results) => {
        console.log('Total rows:', results.data.length);
        console.log('Headers:', Object.keys(results.data[0] || {}));
        console.log('\nFirst 3 rows:');
        results.data.slice(0, 3).forEach((row, i) => {
            console.log(`Row ${i}:`, {
                Reference: row.Reference,
                ID: row.ID,
                Quote: row.Quote,
                Note: row.Note?.substring(0, 50) + '...'
            });
        });
        
        // Check chapter 1 notes
        const chapter1 = results.data.filter(row => {
            const ref = row.Reference || '';
            const [chapter] = ref.split(':');
            return chapter === '1';
        });
        console.log('\nChapter 1 notes count:', chapter1.length);
    },
    error: (error) => {
        console.error('Parse error:', error);
    }
});
