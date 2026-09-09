/**
 * Shared context describing where the currently previewed file lives in the
 * repo, so we can resolve relative `include::` directives against the same
 * repository/branch.
 */
export interface RenderContext {
  projectId: string;
  repositoryId: string;
  /** Branch or commit the file is being viewed at, e.g. "GBmain" or a commit sha. */
  version: string;
  /** Full repo-relative path of the file being previewed, e.g. "/docs/index.adoc". */
  filePath: string;
}

/** Directory portion (repo-relative, leading slash) of a repo path. */
export function dirnameOf(repoPath: string): string {
  const normalized = repoPath.startsWith("/") ? repoPath : `/${repoPath}`;
  const lastSlash = normalized.lastIndexOf("/");
  return lastSlash <= 0 ? "/" : normalized.slice(0, lastSlash);
}

/**
 * Resolves `target` (as used in an `include::target[]` directive) relative to
 * `baseDir`, producing a normalized, repo-relative path (leading slash, no
 * `.`/`..` segments). Returns `null` if the target is not a local repo path
 * (e.g. an absolute URL) or escapes the repository root.
 */
export function resolveRepoRelativePath(baseDir: string, target: string): string | null {
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(target)) {
    // Absolute URL (http://, https://, ...) -> not a local include.
    return null;
  }

  const base = target.startsWith("/") ? "/" : baseDir.endsWith("/") ? baseDir : `${baseDir}/`;
  const combined = target.startsWith("/") ? target : `${base}${target}`;

  const segments = combined.split("/");
  const resolved: string[] = [];
  for (const segment of segments) {
    if (segment === "" || segment === ".") {
      continue;
    }
    if (segment === "..") {
      if (resolved.length === 0) {
        // Escapes repository root.
        return null;
      }
      resolved.pop();
      continue;
    }
    resolved.push(segment);
  }

  return `/${resolved.join("/")}`;
}
