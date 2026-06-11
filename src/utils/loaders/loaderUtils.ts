// src/utils/loaders/loaderUtils.ts
import { file as astroFile, glob as astroGlob } from "astro/loaders";

export const GlobLoad = (collection: string) =>
  astroGlob({ pattern: ["**/*.{md,mdx}", "!**/_*.{md,mdx}"], base: `./src/content/${collection}` });

export const FileLoad = (collection: string, filename: string) =>
  astroFile(`src/content/${collection}/${filename}`);
