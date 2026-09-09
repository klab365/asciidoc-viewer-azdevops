import type { RenderContext } from "../types";

/**
 * The `options` parameter passed to `renderContent(rawContent, options)` is
 * not part of any public, documented contract (see plan.md risks) — its
 * exact shape must be verified at runtime against a real Azure DevOps
 * instance. This extractor tries a handful of plausible property paths and
 * returns `null` if none of them yield a complete context, so callers can
 * degrade gracefully (render the file without resolving includes) instead of
 * throwing.
 */
export function extractRenderContext(options: unknown): RenderContext | null {
  if (!options || typeof options !== "object") {
    return null;
  }

  const o = options as Record<string, any>;
  const candidates = [o, o.context, o.item].filter((v) => v && typeof v === "object");

  const pick = (keys: string[]): string | undefined => {
    for (const candidate of candidates) {
      for (const key of keys) {
        const value = candidate?.[key];
        if (typeof value === "string" && value.length > 0) {
          return value;
        }
        if (value && typeof value === "object" && typeof value.id === "string") {
          return value.id;
        }
      }
    }
    return undefined;
  };

  const projectId = pick(["projectId", "project"]);
  const repositoryId = pick(["repositoryId", "repository", "repoId"]);
  const version = pick(["version", "versionSpec", "branch"]);
  const filePath = pick(["path", "filePath", "itemPath"]);

  if (!projectId || !repositoryId || !version || !filePath) {
    console.warn(
      "[asciidoc-viewer] Could not determine full render context from options; include resolution will be disabled.",
      options
    );
    return null;
  }

  return { projectId, repositoryId, version, filePath };
}
