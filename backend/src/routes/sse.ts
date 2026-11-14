// backend/src/routes/sse.ts
// Minimal Server-Sent Events helper shared by streaming routes.
import type { Response } from 'express';

export function createSse(res: Response, heartbeatMs = 15_000) {
  let closed = false;
  let timer: NodeJS.Timeout | undefined;
  res.on('close', () => { closed = true; });
  const writable = () => !closed && !res.writableEnded;
  return {
    open() {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-store, no-transform',
        Connection: 'keep-alive',
        'X-Accel-Buffering': 'no',
      });
      res.flushHeaders();
      timer = setInterval(() => { if (writable()) res.write(': keep-alive\n\n'); }, heartbeatMs);
    },
    send(event: string, data: unknown) {
      if (!writable()) return;
      try { res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`); } catch { closed = true; }
    },
    end() {
      if (timer) clearInterval(timer);
      if (res.headersSent && !res.writableEnded) res.end();
    },
  };
}
