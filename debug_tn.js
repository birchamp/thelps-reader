const fs = require('fs');
const Papa = require('papaparse');

const content = fs.readFileSync('/Users/birch/Library/Application Support/book-package-reader/resources/unfoldingWord/en_tn/en_tn/tn_GEN.tsv', 'utf8');

Papa.parse(content, {
    header: true,
    complete: (results) => {
        console.log('Headers:', results.meta.fields);
        console.log('First row:', results.data[0]);
    }
});
