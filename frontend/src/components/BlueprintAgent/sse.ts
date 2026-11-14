// src/components/BlueprintAgent/sse.ts
// Incremental Server-Sent Events parser. Pure (no DOM, no fetch), so it is unit-tested with
// chunk boundaries in awkward places: mid-line, between \r and \n, inside a multi-byte character
// (the caller decodes with a streaming TextDecoder).

export interface SseMessage {
  event: string;
  data: string;
}

/** A single event larger than this means something is wrong; refuse rather than grow without bound. */
export const MAX_EVENT_CHARS = 4_000_000;

export class SseOverflowError extends Error {
  constructor() {
    super('SSE event too large');
    this.name = 'SseOverflowError';
  }
}

export function createSseParser(onMessage: (m: SseMessage) => void) {
  let buffer = '';
  let event = '';
  let data: string[] = [];
  let dataChars = 0;
  let skipLf = false; // a "\r" ended the previous chunk: swallow the "\n" that may follow

  const dispatch = () => {
    if (data.length > 0) onMessage({ event: event || 'message', data: data.join('\n') });
    event = '';
    data = [];
    dataChars = 0;
  };

  const line = (l: string) => {
    if (l === '') return dispatch();
    if (l.startsWith(':')) return; // comment / keep-alive
    const i = l.indexOf(':');
    const field = i === -1 ? l : l.slice(0, i);
    let value = i === -1 ? '' : l.slice(i + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') event = value;
    else if (field === 'data') {
      dataChars += value.length + 1;
      if (dataChars > MAX_EVENT_CHARS) throw new SseOverflowError();
      data.push(value);
    }
    // id / retry / unknown fields are ignored: we never auto-reconnect through EventSource.
  };

  return {
    push(chunk: string) {
      if (skipLf && chunk.startsWith('\n')) chunk = chunk.slice(1);
      skipLf = false;
      buffer += chunk;
      let start = 0;
      for (let i = 0; i < buffer.length; i++) {
        const c = buffer.charCodeAt(i);
        if (c !== 10 && c !== 13) continue; // \n or \r
        line(buffer.slice(start, i));
        if (c === 13) {
          if (i + 1 < buffer.length) { if (buffer.charCodeAt(i + 1) === 10) i++; }
          else skipLf = true;
        }
        start = i + 1;
      }
      buffer = buffer.slice(start);
      if (buffer.length > MAX_EVENT_CHARS) throw new SseOverflowError();
    },
    /** The stream ended. An event that was never terminated by a blank line is discarded (it is incomplete). */
    end() {
      buffer = '';
      event = '';
      data = [];
      dataChars = 0;
    },
  };
}
