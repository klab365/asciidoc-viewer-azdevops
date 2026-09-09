import * as SDK from "azure-devops-extension-sdk";
import { getClient } from "azure-devops-extension-api";
import { GitRestClient } from "azure-devops-extension-api/Git";
import type { GitRepository } from "azure-devops-extension-api/Git";
import { renderAsciidoc } from "../renderer/asciidocRenderer";
import { getRepoFileContent } from "../services/gitService";
import type { RenderContext } from "../types";

function getElements() {
  const repoSelect = document.getElementById("repo-select") as HTMLSelectElement | null;
  const filePathInput = document.getElementById("file-path") as HTMLInputElement | null;
  const previewButton = document.getElementById("preview-button") as HTMLButtonElement | null;
  const status = document.getElementById("status");
  const content = document.getElementById("content");
  if (!repoSelect || !filePathInput || !previewButton || !status || !content) {
    throw new Error("Hub page is missing expected elements.");
  }
  return { repoSelect, filePathInput, previewButton, status, content };
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

function normalizeFilePath(path: string): string {
  const trimmed = path.trim();
  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

async function loadRepositories(projectId: string): Promise<GitRepository[]> {
  const client = getClient(GitRestClient);
  return client.getRepositories(projectId);
}

async function main(): Promise<void> {
  await SDK.init({ loaded: false, applyTheme: true });
  await SDK.ready();

  const { repoSelect, filePathInput, previewButton } = getElements();
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
  }

  previewButton.addEventListener("click", async () => {
    const repo = repositories.find((r) => r.id === repoSelect.value);
    const filePathRaw = filePathInput.value;

    if (!repo) {
      showStatus("Please select a repository.", true);
      return;
    }
    if (!filePathRaw.trim()) {
      showStatus("Please enter a file path.", true);
      return;
    }

    const context: RenderContext = {
      projectId,
      repositoryId: repo.id,
      version: branchNameFrom(repo.defaultBranch),
      filePath: normalizeFilePath(filePathRaw)
    };

    showStatus("Loading preview…");
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
  });

  await SDK.notifyLoadSucceeded();
}

main().catch((error) => {
  console.error("[asciidoc-viewer] Failed to initialize hub", error);
  SDK.notifyLoadFailed(error);
});
