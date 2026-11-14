// src/utils/loaders/loaderUtils.ts
import { file as astroFile, glob as astroGlob } from "astro/loaders";
import { layeredFile } from "./layeredFile";

export const GlobLoad = (collection: string) =>
  astroGlob({ pattern: ["**/*.{md,mdx}", "!**/_*.{md,mdx}"], base: `./src/content/${collection}` });

export const FileLoad = (
  collection: string,
  filename: string,
  options?: { sources: string[] },
) => options ? layeredFile(options.sources) : astroFile(`src/content/${collection}/${filename}`);
