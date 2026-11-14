// src/hooks/useCookieStorage.ts
import { useCallback } from 'react';
import { getCookie as getCookieUtil, setCookie as setCookieUtil, clearCookie as clearCookieUtil, type CookieOptions } from '@/utils/cookies';

export function useCookieStorage() {
  const getCookie = useCallback((name: string): string | null => {
    return getCookieUtil(name);
  }, []);

  const setCookie = useCallback((
    name: string, 
    value: string, 
    options: CookieOptions = {}
  ): void => {
    setCookieUtil(name, value, options);
  }, []);

  const deleteCookie = useCallback((name: string, path: string = '/'): void => {
    clearCookieUtil(name, { path });
  }, []);

  return { getCookie, setCookie, deleteCookie };
}