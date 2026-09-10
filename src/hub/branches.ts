/** Minimal shape of a Git ref needed to derive a branch name (subset of `GitRef`). */
export interface RefLike {
  name: string;
}

/** Strips the "refs/heads/" prefix from a ref name, e.g. from `GitRestClient.getRefs`. */
export function branchNameFromRef(ref: RefLike): string {
  return ref.name.replace(/^refs\/heads\//, "");
}

/** Maps raw refs to branch names, sorted alphabetically. */
export function branchNamesFromRefs(refs: RefLike[]): string[] {
  return refs.map(branchNameFromRef).sort((a, b) => a.localeCompare(b));
}

/**
 * Picks which branch should be selected initially in the branch dropdown,
 * preferring (in order): a branch requested via deep link, the repository's
 * default branch, or simply the first available branch.
 */
export function pickInitialBranch(
  branchNames: string[],
  requestedBranch: string | null,
  defaultBranchName: string
): string {
  if (requestedBranch && branchNames.includes(requestedBranch)) {
    return requestedBranch;
  }
  if (branchNames.includes(defaultBranchName)) {
    return defaultBranchName;
  }
  return branchNames[0];
}
