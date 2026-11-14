// src/utils/videoThumbnails.ts
/**
 * Video Thumbnail Utilities
 * Extracts poster frames from videos at build time using ffmpeg.
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir } from "node:fs/promises";
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const execFileAsync = promisify(execFile);

// Loaded on first use, not at import: the build's thumbnail cleanup imports this
// module from astro.config, and that has to work on a site without ffmpeg.
let ffmpegPath: Promise<string> | undefined;
function getFfmpegPath(): Promise<string> {
  ffmpegPath ??= import("@ffmpeg-installer/ffmpeg").then((m) => m.default.path);
  return ffmpegPath;
}

const PROJECT_ROOT = process.cwd();
const PUBLIC_DIR = path.join(PROJECT_ROOT, "public");
const THUMB_DIR = path.join(PUBLIC_DIR, "__video-thumbnails");
const THUMB_ROUTE = "/__video-thumbnails";

async function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
}

function resolveVideoPath(src: string): string {
  if (src.startsWith("/")) {
    return path.join(PUBLIC_DIR, src.slice(1));
  }
  if (path.isAbsolute(src)) {
    return src;
  }
  return path.join(PROJECT_ROOT, src);
}

/**
 * Cache name for a video's thumbnails. The filename alone is not unique —
 * several projects ship a `desktop.mp4`, and they used to share (and overwrite
 * each other's) cached frames. A short hash of the video's path within public/
 * plus its file size keeps same-named videos apart and regenerates the frame
 * when a video is re-exported. Size, not mtime: a git checkout resets mtimes,
 * which would force a regeneration on every deploy.
 */
function getBaseName(videoPath: string): string {
  const name = path.basename(videoPath, path.extname(videoPath));
  const relPath = path.relative(PUBLIC_DIR, videoPath).split(path.sep).join("/");
  const hash = createHash("sha1")
    .update(`${relPath}:${fs.statSync(videoPath).size}`)
    .digest("hex")
    .slice(0, 8);
  return `${name}-${hash}`;
}

function toSafeNumberToken(value: number): string {
  return String(value).replace(/\./g, "_");
}

function buildVariantKey(options: { timecodeSeconds: number; width: number }): string {
  const timeToken = toSafeNumberToken(options.timecodeSeconds);
  return `t${timeToken}-w${options.width}`;
}

export interface PosterResult {
  src: string;
  placeholderSrc?: string;
  width: number;
  height: number;
}

/**
 * Extract a poster frame from a video and generate optimized versions.
 */
export async function generateVideoPoster(
  videoSrc: string,
  options: { timecodeSeconds?: number; generateThumbAt?: number; width?: number } = {}
): Promise<PosterResult> {
  const { timecodeSeconds = options.generateThumbAt ?? 0, width = 1600 } = options;

  const videoPath = resolveVideoPath(videoSrc);
  if (!fs.existsSync(videoPath)) {
    throw new Error(`[videoThumbnails] Video not found: ${videoPath}`);
  }

  await ensureDir(THUMB_DIR);

  const baseName = getBaseName(videoPath);
  const variantKey = buildVariantKey({ timecodeSeconds, width });
  const rawFrame = path.join(THUMB_DIR, `${baseName}-${variantKey}-raw.jpg`);
  const posterFile = path.join(THUMB_DIR, `${baseName}-${variantKey}-poster.webp`);
  const placeholderFile = path.join(THUMB_DIR, `${baseName}-${variantKey}-placeholder.webp`);

  // Extract frame if not exists
  if (!fs.existsSync(rawFrame)) {
    const args = ["-y"];
    if (timecodeSeconds > 0) {
      args.push("-ss", timecodeSeconds.toString());
    }
    args.push("-i", videoPath, "-frames:v", "1", "-q:v", "2", rawFrame);
    await execFileAsync(await getFfmpegPath(), args);
  }

  const sharp = (await import("sharp")).default;
  const metadata = await sharp(rawFrame).metadata();

  if (!metadata.width || !metadata.height) {
    throw new Error(`[videoThumbnails] Could not read frame metadata`);
  }

  const aspectRatio = metadata.height / metadata.width;
  const posterHeight = Math.round(width * aspectRatio);

  // Generate poster if not exists
  if (!fs.existsSync(posterFile)) {
    await sharp(rawFrame)
      .resize(width, posterHeight, { fit: "cover" })
      .webp({ quality: 80 })
      .toFile(posterFile);
  }

  // Generate placeholder if not exists
  if (!fs.existsSync(placeholderFile)) {
    await sharp(rawFrame)
      .resize(32)
      .webp({ quality: 30 })
      .blur()
      .toFile(placeholderFile);
  }

  markThumbnailsUsed(baseName);

  return {
    src: `${THUMB_ROUTE}/${baseName}-${variantKey}-poster.webp`,
    placeholderSrc: `${THUMB_ROUTE}/${baseName}-${variantKey}-placeholder.webp`,
    width,
    height: posterHeight,
  };
}

/**
 * Stamp every cached file for this video with the current time. A build notes
 * when it started; any thumbnail it never stamped belongs to a video that was
 * removed, renamed or re-exported, and `pruneStaleVideoThumbnails` deletes it.
 */
function markThumbnailsUsed(baseName: string) {
  const now = new Date();
  for (const file of fs.readdirSync(THUMB_DIR)) {
    if (file.startsWith(`${baseName}-`)) {
      fs.utimesSync(path.join(THUMB_DIR, file), now, now);
    }
  }
}

/**
 * Every site whose build reads this public/: the workspace packages when
 * public/ sits at a monorepo root (i75's sites/*), otherwise just the one
 * project. Workspace entries are matched literally or as a trailing `dir/*`.
 */
function sitesSharingPublic(): string[] {
  const root = path.dirname(PUBLIC_DIR);
  let workspaces: unknown;
  try {
    workspaces = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).workspaces;
  } catch {
    // no readable package.json: a single site
  }
  if (!Array.isArray(workspaces)) return [root];
  const sites = workspaces
    .flatMap((entry: string) => {
      if (!entry.endsWith("/*")) return [path.join(root, entry)];
      const dir = path.join(root, entry.slice(0, -2));
      return fs.existsSync(dir) ? fs.readdirSync(dir).map((name) => path.join(dir, name)) : [];
    })
    .filter((dir: string) => fs.existsSync(path.join(dir, "package.json")));
  return sites.includes(PROJECT_ROOT) ? sites : [...sites, PROJECT_ROOT];
}

/**
 * Delete the thumbnails no build uses any more. Runs once per build, after
 * every page has rendered (see the video-thumbnails integration).
 *
 * 1. The files this build stamped (mtime >= `since`) are the ones it used. The
 *    copy in `outDir` is trimmed to exactly those, and any that are missing are
 *    copied in: Astro copies public/ into the output before every page has
 *    rendered, so a poster generated late in a build would otherwise not ship.
 * 2. That list is recorded for this site, and public/ loses every file no
 *    site's record lists — but only once every site sharing public/ has a
 *    record, since one site's build cannot know what the others need. A
 *    single-site project is its own only site, so it is swept every build.
 *    A record only refreshes when its site builds, so a stale one keeps files
 *    a little longer; it never deletes one in use.
 */
export function pruneStaleVideoThumbnails(options: { since: number; outDir: string }): {
  used: number;
  removed: number;
  waitingFor: string[];
} {
  const { since, outDir } = options;
  const root = path.dirname(PUBLIC_DIR);
  const recordDir = path.join(root, "node_modules", ".cache", "video-thumbnails");
  const recordFile = (site: string) =>
    path.join(recordDir, `${path.relative(root, site).split(path.sep).join("__") || "root"}.json`);

  const used = fs.existsSync(THUMB_DIR)
    ? fs
        .readdirSync(THUMB_DIR)
        .filter((file) => fs.statSync(path.join(THUMB_DIR, file)).mtimeMs >= since)
    : [];
  const usedSet = new Set(used);
  let removed = 0;

  const outThumbDir = path.join(outDir, THUMB_ROUTE.slice(1));
  if (fs.existsSync(outThumbDir)) {
    for (const file of fs.readdirSync(outThumbDir)) {
      if (usedSet.has(file)) continue;
      fs.rmSync(path.join(outThumbDir, file), { force: true });
      removed++;
    }
  }
  if (used.length > 0) {
    fs.mkdirSync(outThumbDir, { recursive: true });
    for (const file of used) {
      const target = path.join(outThumbDir, file);
      if (!fs.existsSync(target)) fs.copyFileSync(path.join(THUMB_DIR, file), target);
    }
  }

  fs.mkdirSync(recordDir, { recursive: true });
  fs.writeFileSync(recordFile(PROJECT_ROOT), JSON.stringify(used));
  const sites = sitesSharingPublic();
  const waitingFor = sites
    .filter((site) => !fs.existsSync(recordFile(site)))
    .map((site) => path.relative(root, site));
  if (waitingFor.length === 0 && fs.existsSync(THUMB_DIR)) {
    const keep = new Set<string>(
      sites.flatMap((site) => JSON.parse(fs.readFileSync(recordFile(site), "utf8"))),
    );
    for (const file of fs.readdirSync(THUMB_DIR)) {
      if (keep.has(file)) continue;
      fs.rmSync(path.join(THUMB_DIR, file), { force: true });
      removed++;
    }
  }
  return { used: used.length, removed, waitingFor };
}
