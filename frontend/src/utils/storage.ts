// src/utils/storage.ts
/**
 * LocalStorage Utilities
 * 
 * Pure functions for localStorage operations that work in both:
 * - Vanilla JavaScript (inline scripts, Astro components)
 * - React components and hooks
 */

/**
 * Get an item from localStorage
 */
export function getStorageItem(key: string): string | null {
  if (typeof localStorage === 'undefined') return null;
  
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.error(`Error reading localStorage key ${key}:`, error);
    return null;
  }
}

/**
 * Set an item in localStorage
 */
export function setStorageItem(key: string, value: string): void {
  if (typeof localStorage === 'undefined') return;
  
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error(`Error setting localStorage key ${key}:`, error);
  }
}

/**
 * Remove an item from localStorage
 */
export function removeStorageItem(key: string): void {
  if (typeof localStorage === 'undefined') return;
  
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.error(`Error removing localStorage key ${key}:`, error);
  }
}

/**
 * Clear all items matching a prefix
 */
export function clearStorageByPrefix(prefix: string): void {
  if (typeof localStorage === 'undefined') return;
  
  try {
    const keysToRemove = Object.keys(localStorage).filter(key => 
      key.startsWith(prefix)
    );
    
    keysToRemove.forEach(key => localStorage.removeItem(key));
  } catch (error) {
    console.error(`Error clearing localStorage with prefix ${prefix}:`, error);
  }
}

/**
 * Get JSON from localStorage
 */
export function getStorageJSON<T>(key: string): T | null {
  const value = getStorageItem(key);
  
  if (!value) return null;
  
  try {
    return JSON.parse(value) as T;
  } catch (error) {
    console.error(`Error parsing JSON from localStorage key ${key}:`, error);
    return null;
  }
}

/**
 * Set JSON in localStorage
 */
export function setStorageJSON<T>(key: string, value: T): void {
  try {
    const json = JSON.stringify(value);
    setStorageItem(key, json);
  } catch (error) {
    console.error(`Error stringifying JSON for localStorage key ${key}:`, error);
  }
}