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

function getBaseName(videoPath: string): string {
  return path.basename(videoPath, path.extname(videoPath));
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
  options: { timecodeSeconds?: number; width?: number } = {}
): Promise<PosterResult> {
  const { timecodeSeconds = 0, width = 1600 } = options;

  const videoPath = resolveVideoPath(videoSrc);
  if (!fs.existsSync(videoPath)) {
    throw new Error(`[videoThumbnails] Video not found: ${videoPath}`);
  }

  await ensureDir(THUMB_DIR);

  const baseName = getBaseName(videoPath);
  const rawFrame = path.join(THUMB_DIR, `${baseName}-raw.jpg`);
  // Key the poster file by its target width, so different consumers (e.g. the
  // homepage cards at 960 vs a project page at 1600) each get a correctly-sized
  // poster instead of whichever width happened to generate first winning the
  // shared `${baseName}-poster.webp` cache.
  const posterFile = path.join(THUMB_DIR, `${baseName}-${width}-poster.webp`);
  const placeholderFile = path.join(THUMB_DIR, `${baseName}-placeholder.webp`);

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

  // Never upscale past the source frame — that only bloats the file with no
  // added detail (e.g. a 1440px frame asked for 1600).
  const targetWidth = Math.min(width, metadata.width);
  const aspectRatio = metadata.height / metadata.width;
  const posterHeight = Math.round(targetWidth * aspectRatio);

  // Generate poster if not exists
  if (!fs.existsSync(posterFile)) {
    await sharp(rawFrame)
      .resize(targetWidth, posterHeight, { fit: "cover" })
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
    src: `${THUMB_ROUTE}/${baseName}-${width}-poster.webp`,
    placeholderSrc: `${THUMB_ROUTE}/${baseName}-placeholder.webp`,
    width: targetWidth,
    height: posterHeight,
  };
}
