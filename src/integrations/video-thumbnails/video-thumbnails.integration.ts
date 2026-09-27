// src/integrations/video-thumbnails/video-thumbnails.integration.ts
/**
 * Deletes auto-generated video thumbnails that the build no longer uses.
 *
 * Posters are generated on demand while pages render (src/utils/videoThumbnails.ts)
 * and each render stamps the files it used. Once the build is done, anything
 * left unstamped — frames for removed, renamed or re-exported videos — is
 * deleted from the build output and from public/__video-thumbnails. The same
 * integration serves single sites and monorepos with a shared public/; see
 * pruneStaleVideoThumbnails. Dev never prunes: it renders pages lazily, so
 * "not requested yet" is not "unused".
 */
import type { AstroIntegration } from "astro";
import { fileURLToPath } from "node:url";
import { pruneStaleVideoThumbnails } from "../../utils/videoThumbnails";

export default function videoThumbnailsIntegration(): AstroIntegration {
  let buildStartedAt = 0;
  return {
    name: "video-thumbnails",
    hooks: {
      "astro:build:start": () => {
        buildStartedAt = Date.now();
      },
      "astro:build:done": ({ dir, logger }) => {
        const { used, removed, waitingFor } = pruneStaleVideoThumbnails({
          since: buildStartedAt,
          outDir: fileURLToPath(dir),
        });
        logger.info(`Kept ${used} video thumbnail files, removed ${removed} unused.`);
        if (waitingFor.length > 0) {
          logger.info(`Shared public/ is swept once these sites have built: ${waitingFor.join(", ")}.`);
        }
      },
    },
  };
}
