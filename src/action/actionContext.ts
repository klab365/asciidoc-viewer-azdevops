import type { RenderContext } from "../types";

interface KnownSourceItemActionContext {
  gitRepository?: {
    id?: string;
    project?: { id?: string; name?: string };
  };
  item?: {
    path?: string;
  };
  version?: string;
}

/**
 * The `actionContext` parameter passed to a `ms.vss-code-web.source-item-menu`
 * action's `execute(actionContext)` isn't part of any public, documented
 * contract — its shape was verified empirically against a live Azure DevOps
 * instance (see plan.md):
 *
 * ```
 * {
 *   gitRepository: { id, name, url, project: { id, name, ... }, defaultBranch, ... },
 *   item: { sourceProvider: "Git", path: "/test.adoc", item: {...}, url: "?path=...&version=GBmain" },
 *   version: "main",
 *   getSourceItemContext: () => ...
 * }
 * ```
 *
 * This extractor targets that shape first, then falls back to a handful of
 * other plausible property paths (in case other menu targets like the grid
 * or tree variants shape things slightly differently), and returns `null` if
 * nothing yields a complete context — callers can then degrade gracefully
 * (render without resolving includes) instead of throwing.
 */
export function extractRenderContext(actionContext: unknown): RenderContext | null {
  if (!actionContext || typeof actionContext !== "object") {
    return null;
  }

  const known = actionContext as KnownSourceItemActionContext;
  const knownResult: RenderContext | null =
    known.gitRepository?.id && known.gitRepository.project?.id && known.item?.path && known.version
      ? {
          projectId: known.gitRepository.project.id,
          repositoryId: known.gitRepository.id,
          version: known.version,
          filePath: known.item.path
        }
      : null;

  if (knownResult) {
    return knownResult;
  }

  const fallbackResult = extractWithFallbackHeuristics(actionContext);
  if (!fallbackResult) {
    console.warn(
      "[asciidoc-viewer] Could not determine full render context from actionContext; include resolution will be disabled.",
      actionContext
    );
  }
  return fallbackResult;
}

/** Best-effort extraction for shapes that don't match the verified `source-item-menu` contract. */
function extractWithFallbackHeuristics(actionContext: unknown): RenderContext | null {
  const o = actionContext as Record<string, unknown>;
  const candidates = [o, o.context, o.item, o.gitRepository, o.repository].filter(
    (v): v is Record<string, unknown> => !!v && typeof v === "object"
  );

  const pick = (keys: string[]): string | undefined => {
    for (const candidate of candidates) {
      for (const key of keys) {
        const value = candidate[key];
        if (typeof value === "string" && value.length > 0) {
          return value;
        }
        if (value && typeof value === "object" && typeof (value as Record<string, unknown>).id === "string") {
          return (value as Record<string, unknown>).id as string;
        }
      }
    }
    return undefined;
  };

  const projectId = pick(["projectId", "project"]);
  const repositoryId = pick(["repositoryId", "repository", "repoId", "id"]);
  const version = pick(["version", "versionSpec", "branch"]);
  const filePath = pick(["path", "filePath", "itemPath"]);

  if (!projectId || !repositoryId || !version || !filePath) {
    return null;
  }

  return { projectId, repositoryId, version, filePath };
}
