// src/utils/string.ts
/**
 * String Manipulation Utilities
 * 
 * Common string operations used throughout the app:
 * - Case transformations (capitalize, kebab-case, PascalCase)
 * - Reference normalization (extracting IDs)
 * - Phone number formatting
 * 
 * General-purpose utilities with no dependencies.
 */

/**
 * Capitalize the first letter of a string
 * 
 * @param str - String to capitalize
 * @returns String with first letter uppercase
 * @example
 * capitalize('hello') // 'Hello'
 * capitalize('HELLO') // 'HELLO'
 */
export function capitalize(str: string): string {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export function uppercase(str: string): string {
  return str ? str.toUpperCase() : str;
}

/**
 * Capitalize the first letter of each word
 *
 * @param str - String to capitalize
 * @returns String with each word capitalized
 * @example
 * capitalizeWords('hello world') // 'Hello World'
 * capitalizeWords('standard-websites') // 'Standard-Websites'
 */
export function capitalizeWords(str: string): string {
  if (!str) return str;
  return str.replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Convert a slug-like string into a readable title.
 *
 * @example
 * humanizeSlug('about-us') // 'About Us'
 * humanizeSlug('web_design') // 'Web Design'
 */
export function humanizeSlug(str: string): string {
  if (!str) return str;

  return capitalizeWords(
    str
      .replace(/[-_]+/g, " ")
      .trim()
      .replace(/\s+/g, " ")
  );
}

/**
 * Convert a string to kebab-case
 * 
 * Handles:
 * - camelCase → kebab-case
 * - PascalCase → kebab-case
 * - Spaces → hyphens
 * - Underscores → hyphens
 * 
 * @param str - String to convert
 * @returns kebab-cased string
 * @example
 * toKebabCase('HelloWorld') // 'hello-world'
 * toKebabCase('some_string') // 'some-string'
 */
export function toKebabCase(str: string): string {
  return str
    .replace(/([a-z])([A-Z])/g, '$1-$2')  // camelCase boundaries
    .replace(/[\s_]+/g, '-')              // spaces and underscores
    .toLowerCase();
}

/**
 * Convert a string to PascalCase
 * 
 * Splits on hyphens, underscores, and spaces, then capitalizes each word.
 * 
 * @param str - String to convert
 * @returns PascalCased string
 * @example
 * toPascalCase('hello-world') // 'HelloWorld'
 * toPascalCase('some_string') // 'SomeString'
 */
export function toPascalCase(str: string): string {
  return str
    .split(/[-_\s]+/)
    .map(word => capitalize(word))
    .join('');
}

/**
 * Normalize a reference to extract its ID string
 * 
 * Handles both:
 * - String IDs: 'jane-doe'
 * - Reference objects: { collection: 'authors', id: 'jane-doe' }
 * 
 * @param ref - Reference in any format
 * @returns ID as string
 * @example
 * normalizeRef('jane-doe') // 'jane-doe'
 * normalizeRef({ id: 'jane-doe' }) // 'jane-doe'
 */
export function normalizeRef(ref: any): string {
  if (typeof ref === 'string') return ref;
  if (ref?.id) return ref.id;
  return String(ref);
}

/**
 * Format a phone number into (123) 456-7890 format
 * 
 * Strips non-digits, then formats if exactly 10 digits.
 * Returns original string if not 10 digits.
 * 
 * @param phone - Phone number string
 * @returns Formatted phone number
 * @example
 * formatPhoneNumber('1234567890') // '123-456-7890'
 * formatPhoneNumber('123-456-7890') // '123-456-7890'
 */
export function formatPhoneNumber(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3');
  }
  return phone;
}

/**
 * Format phone number with international code
 * 
 * @param phone - Phone number to format
 * @param countryCode - Country code (default: +1 for US)
 * @returns Formatted phone with country code
 * @example
 * formatPhoneNumberInternational('1234567890') // '+1 123-456-7890'
 */
export function formatPhoneNumberInternational(phone: string, countryCode: string = '+1'): string {
  const formatted = formatPhoneNumber(phone);
  return `${countryCode} ${formatted}`;
}
