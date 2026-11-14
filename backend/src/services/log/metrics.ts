// backend/src/services/log/metrics.ts
// Small in-process counters and timings, per instance (reset on restart). Label values must come
// from small fixed sets (route patterns, job names, outcomes), never from visitor input.

type Labels = Record<string, string | number>;

interface Timing { count: number; sum: number; max: number }

const keyOf = (name: string, labels: Labels = {}) =>
  `${name}|${Object.entries(labels).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join(',')}`;
const parseKey = (key: string) => {
  const [name, rest = ''] = key.split('|');
  const labels: Record<string, string> = {};
  for (const part of rest.split(',').filter(Boolean)) { const i = part.indexOf('='); labels[part.slice(0, i)] = part.slice(i + 1); }
  return { name, labels };
};

export class Metrics {
  private readonly startedAt = Date.now();
  private readonly counters = new Map<string, number>();
  private readonly timings = new Map<string, Timing>();

  inc(name: string, labels?: Labels, by = 1): void {
    const k = keyOf(name, labels);
    this.counters.set(k, (this.counters.get(k) ?? 0) + by);
  }

  observe(name: string, labels: Labels | undefined, ms: number): void {
    const k = keyOf(name, labels);
    const t = this.timings.get(k) ?? { count: 0, sum: 0, max: 0 };
    t.count++; t.sum += ms; t.max = Math.max(t.max, ms);
    this.timings.set(k, t);
  }

  snapshot() {
    return {
      startedAt: new Date(this.startedAt).toISOString(),
      uptimeSeconds: Math.round((Date.now() - this.startedAt) / 1000),
      counters: [...this.counters].map(([k, value]) => ({ ...parseKey(k), value })).sort((a, b) => a.name.localeCompare(b.name)),
      timings: [...this.timings].map(([k, t]) => ({ ...parseKey(k), count: t.count, avgMs: Math.round(t.sum / t.count), maxMs: Math.round(t.max) })).sort((a, b) => a.name.localeCompare(b.name)),
    };
  }

  reset(): void { this.counters.clear(); this.timings.clear(); }
}

export const metrics = new Metrics();
