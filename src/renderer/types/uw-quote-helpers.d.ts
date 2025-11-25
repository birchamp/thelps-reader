declare module 'uw-quote-helpers' {
    export function cleanQuoteString(quote: string): string;
    export function normalize(str: string, isOrigLang?: boolean): string;
    export function tokenizeQuote(quote: string): string[];
}
