// src/utils/cookies.ts
/**
 * Cookie Utilities
 * 
 * Pure functions for cookie manipulation that work in both:
 * - Vanilla JavaScript (inline scripts, Astro components)
 * - React components and hooks
 * 
 * No dependencies - can be used anywhere in the browser.
 */

export interface CookieOptions {
  expires?: number; // days
  path?: string;
  sameSite?: 'Strict' | 'Lax' | 'None';
  secure?: boolean;
  domain?: string;
}

/**
 * Get a cookie value by name
 */
export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  
  try {
    const value = '; ' + document.cookie;
    const parts = value.split('; ' + name + '=');
    
    if (parts.length === 2) {
      const cookieValue = parts.pop()?.split(';').shift();
      return cookieValue ? decodeURIComponent(cookieValue) : null;
    }
    
    return null;
  } catch (error) {
    console.error(`Error reading cookie ${name}:`, error);
    return null;
  }
}

/**
 * Set a cookie with options
 */
export function setCookie(
  name: string,
  value: string,
  options: CookieOptions = {}
): void {
  if (typeof document === 'undefined') return;
  
  try {
    const {
      expires = 365,
      path = '/',
      sameSite = 'Strict',
      secure = true,
      domain,
    } = options;

    const expiryDate = new Date();
    expiryDate.setTime(expiryDate.getTime() + expires * 24 * 60 * 60 * 1000);

    const cookieParts = [
      `${name}=${encodeURIComponent(value)}`,
      `expires=${expiryDate.toUTCString()}`,
      `path=${path}`,
      `SameSite=${sameSite}`,
    ];

    if (secure) {
      cookieParts.push('Secure');
    }

    if (domain) {
      cookieParts.push(`domain=${domain}`);
    }

    document.cookie = cookieParts.join('; ');
  } catch (error) {
    console.error(`Error setting cookie ${name}:`, error);
  }
}

/**
 * Delete a cookie
 */
export function clearCookie(name: string, options: Pick<CookieOptions, 'path' | 'domain'> = {}): void {
  if (typeof document === 'undefined') return;
  
  try {
    const { path = '/', domain } = options;
    
    const cookieParts = [
      `${name}=`,
      'expires=Thu, 01 Jan 1970 00:00:00 UTC',
      `path=${path}`,
    ];

    if (domain) {
      cookieParts.push(`domain=${domain}`);
    }

    document.cookie = cookieParts.join('; ');
    
    // Also try to clear with hostname as domain
    if (!domain && typeof window !== 'undefined') {
      document.cookie = cookieParts.join('; ') + `; domain=${window.location.hostname}`;
    }
  } catch (error) {
    console.error(`Error deleting cookie ${name}:`, error);
  }
}

/**
 * Check if a cookie exists
 */
export function hasCookie(name: string): boolean {
  return getCookie(name) !== null;
}