import type { FileEntry } from "../hub/tree";

const ADOC_EXTENSION_RE = /\.(adoc|asciidoc)$/i;

/** Bit flag for `VersionControlChangeType.Delete` (see `azure-devops-extension-api/Git`). */
const DELETE_CHANGE_TYPE_BIT = 16;

/** Minimal shape of a `GitPullRequestChange` needed to find changed AsciiDoc files. */
export interface PullRequestChangeLike {
  changeType: number;
  item?: {
    path?: string;
    isFolder?: boolean;
  } | null;
}

/**
 * Filters pull request iteration changes down to non-deleted `.adoc`/`.asciidoc`
 * file entries, de-duplicated by path and sorted alphabetically.
 */
export function adocFileEntriesFromChanges(changes: PullRequestChangeLike[]): FileEntry[] {
  const seen = new Set<string>();
  const entries: FileEntry[] = [];

  for (const change of changes) {
    const item = change.item;
    if (!item || item.isFolder || !item.path) {
      continue;
    }
    const isDeleted = (change.changeType & DELETE_CHANGE_TYPE_BIT) === DELETE_CHANGE_TYPE_BIT;
    if (isDeleted) {
      continue;
    }
    if (!ADOC_EXTENSION_RE.test(item.path)) {
      continue;
    }
    if (seen.has(item.path)) {
      continue;
    }
    seen.add(item.path);
    entries.push({ path: item.path, kind: "adoc" });
  }

  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

/** Minimal shape of a `GitPullRequest` needed to pick a commit to render at. */
export interface PullRequestCommitsLike {
  lastMergeSourceCommit?: { commitId?: string } | null;
  lastMergeTargetCommit?: { commitId?: string } | null;
}

/**
 * Picks the commit AsciiDoc files should be rendered/resolved at: the pull
 * request's source commit (the proposed changes), falling back to the
 * target commit if the source commit is unavailable (e.g. a completed or
 * abandoned pull request). Returns `null` if neither is available.
 */
export function commitForPullRequest(pr: PullRequestCommitsLike): string | null {
  return pr.lastMergeSourceCommit?.commitId ?? pr.lastMergeTargetCommit?.commitId ?? null;
}

/** Picks the highest iteration id from a pull request's iteration list, or `null` if there are none. */
export function latestIterationId(iterations: Array<{ id?: number }>): number | null {
  const ids = iterations.map((iteration) => iteration.id).filter((id): id is number => typeof id === "number");
  return ids.length > 0 ? Math.max(...ids) : null;
}
