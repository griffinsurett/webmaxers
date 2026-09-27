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
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";

const execFileAsync = promisify(execFile);

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
 * each other's) cached frames. A short hash of the public-relative path plus
 * the file size keeps same-named videos apart and regenerates the frame when a
 * video is re-exported. Size, not mtime: a git checkout resets mtimes, which
 * would force a regeneration on every deploy.
 */
function getBaseName(videoPath: string): string {
  const name = path.basename(videoPath, path.extname(videoPath));
  const relPath = path.relative(PROJECT_ROOT, videoPath).split(path.sep).join("/");
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
    await execFileAsync(ffmpegInstaller.path, args);
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

  return {
    src: `${THUMB_ROUTE}/${baseName}-${variantKey}-poster.webp`,
    placeholderSrc: `${THUMB_ROUTE}/${baseName}-${variantKey}-placeholder.webp`,
    width,
    height: posterHeight,
  };
}
