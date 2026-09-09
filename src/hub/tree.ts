export interface TreeFolder {
  type: "folder";
  name: string;
  children: Map<string, TreeNode>;
}

export interface TreeFile {
  type: "file";
  name: string;
  path: string;
}

export type TreeNode = TreeFolder | TreeFile;

/** Builds a nested folder/file tree from a flat list of repo-relative file paths. */
export function buildTree(paths: string[]): TreeFolder {
  const root: TreeFolder = { type: "folder", name: "", children: new Map() };

  for (const path of paths) {
    const segments = path.split("/").filter(Boolean);
    let current = root;
    segments.forEach((segment, index) => {
      const isLast = index === segments.length - 1;
      if (isLast) {
        current.children.set(segment, { type: "file", name: segment, path });
        return;
      }
      const existing = current.children.get(segment);
      if (existing && existing.type === "folder") {
        current = existing;
        return;
      }
      const folder: TreeFolder = { type: "folder", name: segment, children: new Map() };
      current.children.set(segment, folder);
      current = folder;
    });
  }

  return root;
}

/** Sorts tree entries: folders before files, then alphabetically by name. */
export function sortedTreeEntries(folder: TreeFolder): TreeNode[] {
  return [...folder.children.values()].sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === "folder" ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });
}
