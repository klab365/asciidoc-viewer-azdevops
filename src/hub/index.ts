import * as SDK from "azure-devops-extension-sdk";
import { getClient } from "azure-devops-extension-api";
import { GitRestClient, VersionControlRecursionType } from "azure-devops-extension-api/Git";
import type { GitItem, GitRepository } from "azure-devops-extension-api/Git";
import { renderAsciidoc } from "../renderer/asciidocRenderer";
import { getRepoFileContent, getRepoBinaryContent } from "../services/gitService";
import { mimeTypeFor } from "../renderer/imageExtension";
import { highlightSourceBlocks } from "../renderer/syntaxHighlighting";
import type { RenderContext } from "../types";
import "highlight.js/styles/github.css";
import { buildTree, type FileEntry, type FileKind } from "./tree";
import { renderTree } from "./treeView";
import { branchNamesFromRefs, pickInitialBranch } from "./branches";
import { detectCurrentRepository } from "./currentRepo";
import {
  readSelectedPathFromUrl,
  writeSelectedPathToUrl,
  readSelectedBranchFromUrl,
  writeSelectedBranchToUrl
} from "./urlState";

const ADOC_EXTENSION_RE = /\.(adoc|asciidoc)$/i;
const IMAGE_EXTENSION_RE = /\.(svg|png|jpe?g|gif|webp|bmp)$/i;
const PLANTUML_EXTENSION_RE = /\.(puml|plantuml)$/i;

function getElements() {
  const repoPicker = document.getElementById("repo-picker");
  const repoSelect = document.getElementById("repo-select") as HTMLSelectElement | null;
  const branchSelect = document.getElementById("branch-select") as HTMLSelectElement | null;
  const fileTree = document.getElementById("file-tree");
  const fileTreeToggle = document.getElementById("file-tree-toggle") as HTMLButtonElement | null;
  const status = document.getElementById("status");
  const content = document.getElementById("content");
  if (!repoPicker || !repoSelect || !branchSelect || !fileTree || !fileTreeToggle || !status || !content) {
    throw new Error("Hub page is missing expected elements.");
  }
  return { repoPicker, repoSelect, branchSelect, fileTree, fileTreeToggle, status, content };
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
  highlightSourceBlocks(content);
}

function showImage(dataUri: string, path: string): void {
  const { status, content } = getElements();
  status.hidden = true;
  content.hidden = false;
  content.innerHTML = "";
  const img = document.createElement("img");
  img.src = dataUri;
  img.alt = path;
  img.className = "standalone-image";
  content.appendChild(img);
}

/** Strips the "refs/heads/" prefix from a repository's default branch. */
function branchNameFrom(defaultBranch: string | undefined): string {
  return (defaultBranch ?? "main").replace(/^refs\/heads\//, "");
}

async function loadRepositories(projectId: string): Promise<GitRepository[]> {
  const client = getClient(GitRestClient);
  return client.getRepositories(projectId);
}

/** Loads all branch names of a repository, sorted alphabetically. */
async function loadBranches(projectId: string, repositoryId: string): Promise<string[]> {
  const client = getClient(GitRestClient);
  const refs = await client.getRefs(repositoryId, projectId, "heads/");
  return branchNamesFromRefs(refs);
}

async function loadPreviewablePaths(
  context: Pick<RenderContext, "projectId" | "repositoryId" | "version">
): Promise<FileEntry[]> {
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

  const entries: FileEntry[] = [];
  for (const item of items) {
    if (item.isFolder) continue;
    if (ADOC_EXTENSION_RE.test(item.path)) {
      entries.push({ path: item.path, kind: "adoc" });
    } else if (IMAGE_EXTENSION_RE.test(item.path)) {
      entries.push({ path: item.path, kind: "image" });
    } else if (PLANTUML_EXTENSION_RE.test(item.path)) {
      entries.push({ path: item.path, kind: "diagram" });
    }
  }
  return entries;
}

async function main(): Promise<void> {
  await SDK.init({ loaded: false, applyTheme: true });
  await SDK.ready();

  const { repoPicker, repoSelect, branchSelect, fileTree, fileTreeToggle } = getElements();

  // Hand control over to the hub's own UI (which already shows a status
  // message) as soon as the page shell is ready, instead of making Azure
  // DevOps keep its host-level loading spinner up while we fetch
  // repositories, branches, the file tree, and possibly render a
  // deep-linked file — that chain of network calls can easily take
  // several seconds.
  await SDK.notifyLoadSucceeded();

  const webContext = SDK.getWebContext();
  const projectId = webContext.project?.id;

  if (!projectId) {
    showStatus("Could not determine the current project.", true);
    return;
  }

  let repositories: GitRepository[] = [];
  try {
    repositories = await loadRepositories(projectId);
  } catch (error) {
    console.error("[asciidoc-viewer] Failed to load repositories", error);
    showStatus(`Failed to load repositories: ${(error as Error).message ?? error}`, true);
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
    return;
  }

  let selectedButton: HTMLButtonElement | null = null;
  // Tracks whether the current branch selection came from a deep link, so
  // the very first file-tree load for a repo can honor it; subsequent repo
  // switches always fall back to that repo's default branch.
  let pendingBranchFromUrl: string | null = await readSelectedBranchFromUrl();

  fileTreeToggle.addEventListener("click", () => {
    fileTree.hidden = !fileTree.hidden;
    const isExpanded = !fileTree.hidden;
    fileTreeToggle.textContent = isExpanded ? "‹" : "›";
    fileTreeToggle.setAttribute("aria-expanded", String(isExpanded));
    fileTreeToggle.title = isExpanded ? "Hide file tree" : "Show file tree";
  });

  function selectFileButton(button: HTMLButtonElement): void {
    selectedButton?.parentElement?.classList.remove("selected");
    selectedButton = button;
    button.parentElement?.classList.add("selected");
  }

  /** Populates the branch dropdown for `repo`, returning the branch that should be shown initially. */
  async function loadBranchesFor(repo: GitRepository): Promise<string> {
    const defaultBranchName = branchNameFrom(repo.defaultBranch);
    branchSelect.innerHTML = "";

    let branchNames = [defaultBranchName];
    try {
      branchNames = await loadBranches(projectId!, repo.id);
      if (branchNames.length === 0) {
        branchNames = [defaultBranchName];
      }
    } catch (error) {
      console.error("[asciidoc-viewer] Failed to load branches", error);
      // Fall back to the repository's default branch so the file tree can
      // still be loaded even if listing branches fails.
    }

    for (const name of branchNames) {
      const option = document.createElement("option");
      option.value = name;
      option.textContent = name;
      branchSelect.appendChild(option);
    }

    const requestedBranch = pendingBranchFromUrl;
    pendingBranchFromUrl = null;
    const initialBranch = pickInitialBranch(branchNames, requestedBranch, defaultBranchName);
    branchSelect.value = initialBranch;
    return initialBranch;
  }

  async function loadFileTreeFor(repo: GitRepository, version: string): Promise<void> {
    fileTree.innerHTML = "";
    selectedButton = null;

    try {
      const entries = await loadPreviewablePaths({ projectId: projectId!, repositoryId: repo.id, version });
      if (entries.length === 0) {
        const empty = document.createElement("div");
        empty.className = "tree-empty";
        empty.textContent = "No .adoc/.asciidoc, image, or PlantUML files found in this repository.";
        fileTree.appendChild(empty);
        showStatus("No AsciiDoc, image, or PlantUML files found in this repository.");
        return;
      }

      const tree = buildTree(entries);
      fileTree.appendChild(
        renderTree(tree, async (path, kind, button) => {
          selectFileButton(button);
          await writeSelectedPathToUrl(path);
          await previewFile(repo, version, path, kind);
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
        await previewFile(repo, version, linkedPath, (linkedButton.dataset.kind as FileKind) ?? "adoc");
      } else {
        showStatus("Select a file from the tree.");
      }
    } catch (error) {
      console.error("[asciidoc-viewer] Failed to load file tree", error);
      showStatus(`Failed to load files: ${(error as Error).message ?? error}`, true);
    }
  }

  async function previewFile(repo: GitRepository, version: string, filePath: string, kind: FileKind): Promise<void> {
    const context: RenderContext = {
      projectId: projectId!,
      repositoryId: repo.id,
      version,
      filePath
    };

    showStatus(`Loading preview for ${filePath}…`);
    try {
      if (kind === "image") {
        const bytes = await getRepoBinaryContent(context, filePath);
        if (bytes === null) {
          showStatus(`Could not load image content for "${filePath}".`, true);
          return;
        }
        showImage(`data:${mimeTypeFor(filePath)};base64,${arrayBufferToBase64(bytes)}`, filePath);
        return;
      }

      const mainContent = await getRepoFileContent(context, context.filePath);
      if (mainContent === null) {
        showStatus(`Could not load file content for "${context.filePath}".`, true);
        return;
      }
      const source = kind === "diagram" ? `[plantuml]\n----\n${mainContent}\n----` : mainContent;
      const html = await renderAsciidoc(source, context);
      showContent(html);
    } catch (error) {
      console.error("[asciidoc-viewer] Failed to render preview", error);
      showStatus(`Failed to render preview: ${(error as Error).message ?? error}`, true);
    }
  }

  let currentRepo: GitRepository | null = null;

  async function selectRepo(repo: GitRepository): Promise<void> {
    currentRepo = repo;
    const version = await loadBranchesFor(repo);
    await loadFileTreeFor(repo, version);
  }

  repoSelect.addEventListener("change", () => {
    const repo = repositories.find((r) => r.id === repoSelect.value);
    if (repo) {
      void selectRepo(repo);
    }
  });

  branchSelect.addEventListener("change", () => {
    if (!currentRepo) {
      return;
    }
    const version = branchSelect.value;
    void writeSelectedBranchToUrl(version);
    void loadFileTreeFor(currentRepo, version);
  });

  const detectedRepo = await detectCurrentRepository(repositories);
  if (detectedRepo) {
    // This hub is opened while browsing a specific repository (like the
    // built-in "Files"/"Commits" hubs) — no need to make the user pick it
    // again from a dropdown.
    repoPicker.hidden = true;
    repoSelect.value = detectedRepo.id;
    await selectRepo(detectedRepo);
  } else {
    // Couldn't determine the current repository automatically — fall back
    // to letting the user pick one manually.
    repoPicker.hidden = false;
    await selectRepo(repositories[0]);
  }
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

main().catch((error) => {
  console.error("[asciidoc-viewer] Failed to initialize hub", error);
  SDK.notifyLoadFailed(error);
});
