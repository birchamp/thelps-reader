const fs = require('fs');

const content = fs.readFileSync('/Users/birch/Library/Application Support/book-package-reader/resources/unfoldingWord/en_tn/en_tn/tn_GEN.tsv', 'utf8');
const firstLine = content.split('\n')[0];
const columns = firstLine.split('\t');

console.log('Number of columns:', columns.length);
columns.forEach((col, index) => {
    console.log(`Column ${index}: ${col}`);
});

const secondLine = content.split('\n')[1];
const columns2 = secondLine.split('\t');
console.log('--- Second Line ---');
columns2.forEach((col, index) => {
    console.log(`Column ${index}: ${col}`);
});
