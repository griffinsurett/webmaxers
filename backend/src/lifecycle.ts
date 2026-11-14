// backend/src/lifecycle.ts
// Shared "we are shutting down" flag, so the health check can tell the platform to stop sending
// traffic while in-flight work finishes.
let shuttingDown = false;
export const markShuttingDown = (): void => { shuttingDown = true; };
export const isShuttingDown = (): boolean => shuttingDown;
