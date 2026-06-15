/**
 * Generate a short human-friendly submission reference, e.g. "POTH-7F3K2".
 * The prefix is derived from the form name so references are recognisable.
 */
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no easily-confused chars

export function referencePrefix(formName: string): string {
  const letters = formName.toUpperCase().replace(/[^A-Z]/g, "");
  return (letters.slice(0, 4) || "FORM").padEnd(4, "X");
}

export function generateReference(formName: string): string {
  let suffix = "";
  for (let i = 0; i < 5; i++) {
    suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${referencePrefix(formName)}-${suffix}`;
}
