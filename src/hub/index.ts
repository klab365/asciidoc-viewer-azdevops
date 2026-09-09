import * as SDK from "azure-devops-extension-sdk";
import { getClient } from "azure-devops-extension-api";
import { GitRestClient, VersionControlRecursionType } from "azure-devops-extension-api/Git";
import type { GitItem, GitRepository } from "azure-devops-extension-api/Git";
import { renderAsciidoc } from "../renderer/asciidocRenderer";
import { getRepoFileContent } from "../services/gitService";
import type { RenderContext } from "../types";
import { buildTree, sortedTreeEntries, type TreeFolder } from "./tree";
import { detectCurrentRepository } from "./currentRepo";
import { readSelectedPathFromUrl, writeSelectedPathToUrl } from "./urlState";

const ADOC_EXTENSION_RE = /\.(adoc|asciidoc)$/i;

function getElements() {
  const repoToolbar = document.getElementById("repo-toolbar");
  const repoSelect = document.getElementById("repo-select") as HTMLSelectElement | null;
  const fileTree = document.getElementById("file-tree");
  const status = document.getElementById("status");
  const content = document.getElementById("content");
  if (!repoToolbar || !repoSelect || !fileTree || !status || !content) {
    throw new Error("Hub page is missing expected elements.");
  }
  return { repoToolbar, repoSelect, fileTree, status, content };
}

function showStatus(message: string, isError = false): void {
  const { status, content } = getElements();
  status.hidden = false;
  status.textContent = message;
  status.classList.toggle("error", isError);
  content.hidden = true;
}

function showContent(html: string): void {
  const { status, content } = getElements();
  status.hidden = true;
  content.hidden = false;
  content.innerHTML = html;
}

/** Strips the "refs/heads/" prefix from a repository's default branch. */
function branchNameFrom(defaultBranch: string | undefined): string {
  return (defaultBranch ?? "main").replace(/^refs\/heads\//, "");
}

/** Builds a nested folder/file tree from a flat list of repo-relative AsciiDoc file paths. */
function renderTree(
  folder: TreeFolder,
  onFileSelect: (path: string, element: HTMLButtonElement) => void
): HTMLUListElement {
  const list = document.createElement("ul");
  const sortedEntries = sortedTreeEntries(folder);

  for (const node of sortedEntries) {
    const item = document.createElement("li");
    if (node.type === "folder") {
      item.className = "tree-folder";
      const label = document.createElement("span");
      label.className = "tree-label";
      label.textContent = node.name;
      item.appendChild(label);
      item.appendChild(renderTree(node, onFileSelect));
    } else {
      item.className = "tree-file";
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = node.name;
      button.dataset.path = node.path;
      button.addEventListener("click", () => onFileSelect(node.path, button));
      item.appendChild(button);
    }
    list.appendChild(item);
  }

  return list;
}

async function loadRepositories(projectId: string): Promise<GitRepository[]> {
  const client = getClient(GitRestClient);
  return client.getRepositories(projectId);
}

async function loadAdocPaths(context: Pick<RenderContext, "projectId" | "repositoryId" | "version">): Promise<string[]> {
  const client = getClient(GitRestClient);
  const items: GitItem[] = await client.getItems(
    context.repositoryId,
    context.projectId,
    undefined,
    VersionControlRecursionType.Full,
    false,
    false,
    false,
    false,
    { versionType: 0, versionOptions: 0, version: context.version }
  );
  return items.filter((item) => !item.isFolder && ADOC_EXTENSION_RE.test(item.path)).map((item) => item.path);
}

async function main(): Promise<void> {
  await SDK.init({ loaded: false, applyTheme: true });
  await SDK.ready();

  const { repoToolbar, repoSelect, fileTree } = getElements();
  const webContext = SDK.getWebContext();
  const projectId = webContext.project?.id;

  if (!projectId) {
    showStatus("Could not determine the current project.", true);
    await SDK.notifyLoadSucceeded();
    return;
  }

  let repositories: GitRepository[] = [];
  try {
    repositories = await loadRepositories(projectId);
  } catch (error) {
    console.error("[asciidoc-viewer] Failed to load repositories", error);
    showStatus(`Failed to load repositories: ${(error as Error).message ?? error}`, true);
    await SDK.notifyLoadSucceeded();
    return;
  }

  repoSelect.innerHTML = "";
  for (const repo of repositories) {
    const option = document.createElement("option");
    option.value = repo.id;
    option.textContent = repo.name;
    repoSelect.appendChild(option);
  }

  if (repositories.length === 0) {
    showStatus("No repositories found in this project.", true);
    await SDK.notifyLoadSucceeded();
    return;
  }

  let selectedButton: HTMLButtonElement | null = null;

  function selectFileButton(button: HTMLButtonElement): void {
    selectedButton?.parentElement?.classList.remove("selected");
    selectedButton = button;
    button.parentElement?.classList.add("selected");
  }

  async function loadFileTreeFor(repo: GitRepository): Promise<void> {
    fileTree.innerHTML = "";
    selectedButton = null;
    const version = branchNameFrom(repo.defaultBranch);

    try {
      const paths = await loadAdocPaths({ projectId: projectId!, repositoryId: repo.id, version });
      if (paths.length === 0) {
        const empty = document.createElement("div");
        empty.className = "tree-empty";
        empty.textContent = "No .adoc/.asciidoc files found in this repository.";
        fileTree.appendChild(empty);
        showStatus("No AsciiDoc files found in this repository.");
        return;
      }

      const tree = buildTree(paths);
      fileTree.appendChild(
        renderTree(tree, async (path, button) => {
          selectFileButton(button);
          await writeSelectedPathToUrl(path);
          await previewFile(repo, path);
        })
      );

      // Deep-link support: if the URL already points at a specific file
      // (e.g. from a shared link, or restored from a previous visit), open
      // it automatically instead of showing the generic "select a file"
      // status.
      const linkedPath = await readSelectedPathFromUrl();
      const linkedButton = linkedPath
        ? (fileTree.querySelector<HTMLButtonElement>(`button[data-path="${CSS.escape(linkedPath)}"]`) ?? null)
        : null;
      if (linkedPath && linkedButton) {
        selectFileButton(linkedButton);
        await previewFile(repo, linkedPath);
      } else {
        showStatus("Select a file from the tree.");
      }
    } catch (error) {
      console.error("[asciidoc-viewer] Failed to load file tree", error);
      showStatus(`Failed to load files: ${(error as Error).message ?? error}`, true);
    }
  }

  async function previewFile(repo: GitRepository, filePath: string): Promise<void> {
    const context: RenderContext = {
      projectId: projectId!,
      repositoryId: repo.id,
      version: branchNameFrom(repo.defaultBranch),
      filePath
    };

    showStatus(`Loading preview for ${filePath}…`);
    try {
      const mainContent = await getRepoFileContent(context, context.filePath);
      if (mainContent === null) {
        showStatus(`Could not load file content for "${context.filePath}".`, true);
        return;
      }
      const html = await renderAsciidoc(mainContent, context);
      showContent(html);
    } catch (error) {
      console.error("[asciidoc-viewer] Failed to render AsciiDoc content", error);
      showStatus(`Failed to render AsciiDoc preview: ${(error as Error).message ?? error}`, true);
    }
  }

  repoSelect.addEventListener("change", () => {
    const repo = repositories.find((r) => r.id === repoSelect.value);
    if (repo) {
      void loadFileTreeFor(repo);
    }
  });

  const detectedRepo = await detectCurrentRepository(repositories);
  if (detectedRepo) {
    // This hub is opened while browsing a specific repository (like the
    // built-in "Files"/"Commits" hubs) — no need to make the user pick it
    // again from a dropdown.
    repoToolbar.hidden = true;
    repoSelect.value = detectedRepo.id;
    await loadFileTreeFor(detectedRepo);
  } else {
    // Couldn't determine the current repository automatically — fall back
    // to letting the user pick one manually.
    repoToolbar.hidden = false;
    await loadFileTreeFor(repositories[0]);
  }

  await SDK.notifyLoadSucceeded();
}

main().catch((error) => {
  console.error("[asciidoc-viewer] Failed to initialize hub", error);
  SDK.notifyLoadFailed(error);
});
