import type { TreeFolder, FileKind } from "./tree";
import { sortedTreeEntries } from "./tree";

// Monochrome, `currentColor`-based icons (in the style of Azure DevOps's
// Fluent iconography) so the file tree adapts to the host theme instead of
// showing colourful emoji that clash with it.
const FOLDER_ICON =
  '<svg class="tree-icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M1.5 3A1.5 1.5 0 0 1 3 1.5h3.379a1.5 1.5 0 0 1 1.06.44L8.62 3.12A.5.5 0 0 0 8.98 3.27H13a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H3A1.5 1.5 0 0 1 1.5 12.5V3Z"/></svg>';

const FILE_ICONS: Record<FileKind, string> = {
  adoc: '<svg class="tree-icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4 1.5h5.29a1 1 0 0 1 .7.29l2.21 2.21a1 1 0 0 1 .29.7V13.5A1.5 1.5 0 0 1 10.99 15H4A1.5 1.5 0 0 1 2.5 13.5v-10A1.5 1.5 0 0 1 4 1.5Zm.75 5a.5.5 0 0 0 0 1h6.5a.5.5 0 0 0 0-1h-6.5Zm0 2.5a.5.5 0 0 0 0 1h6.5a.5.5 0 0 0 0-1h-6.5Zm0 2.5a.5.5 0 0 0 0 1h4a.5.5 0 0 0 0-1h-4Z"/></svg>',
  image:
    '<svg class="tree-icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M2.5 3A1.5 1.5 0 0 1 4 1.5h8A1.5 1.5 0 0 1 13.5 3v10A1.5 1.5 0 0 1 12 14.5H4A1.5 1.5 0 0 1 2.5 13V3Zm2.25 2a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5ZM4 12.5h8l-2.9-4.35a.5.5 0 0 0-.79-.05L6.9 10.2 5.98 8.9a.5.5 0 0 0-.82.02L4 12.5Z"/></svg>',
  diagram:
    '<svg class="tree-icon" viewBox="0 0 16 16" aria-hidden="true"><path fill="currentColor" d="M4 1.5a2 2 0 1 0 .5 3.94v3.12a2 2 0 1 0 1 0V6.94A2.001 2.001 0 0 0 8 5h1.44l-1.2 1.2a.5.5 0 0 0 .7.7l2.05-2.04a.5.5 0 0 0 0-.71L8.94 2.1a.5.5 0 1 0-.7.7L9.44 4H8a2 2 0 0 0-2.5 1.94V3.44A2 2 0 0 0 4 1.5Z"/></svg>'
};

/** Escapes text that is interpolated into `innerHTML` (e.g. file/folder names). */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Renders a folder/file tree as nested, collapsible `<details>`/`<ul>` elements.
 * Shared by the repository hub and the pull-request tab, which both show a
 * subset of a repository's AsciiDoc/image/PlantUML files.
 */
export function renderTree(
  folder: TreeFolder,
  onFileSelect: (path: string, kind: FileKind, element: HTMLButtonElement) => void
): HTMLUListElement {
  const list = document.createElement("ul");
  const sortedEntries = sortedTreeEntries(folder);

  for (const node of sortedEntries) {
    const item = document.createElement("li");
    if (node.type === "folder") {
      item.className = "tree-folder";
      const details = document.createElement("details");
      details.open = true;
      const summary = document.createElement("summary");
      summary.className = "tree-label";
      summary.innerHTML = `${FOLDER_ICON}<span class="tree-label-text">${escapeHtml(node.name)}</span>`;
      details.appendChild(summary);
      details.appendChild(renderTree(node, onFileSelect));
      item.appendChild(details);
    } else {
      item.className = "tree-file";
      const button = document.createElement("button");
      button.type = "button";
      button.innerHTML = `${FILE_ICONS[node.kind]}<span class="tree-label-text">${escapeHtml(node.name)}</span>`;
      button.dataset.path = node.path;
      button.dataset.kind = node.kind;
      button.addEventListener("click", () => onFileSelect(node.path, node.kind, button));
      item.appendChild(button);
    }
    list.appendChild(item);
  }

  return list;
}
