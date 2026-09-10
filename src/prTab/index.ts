import * as SDK from "azure-devops-extension-sdk";
import { getClient } from "azure-devops-extension-api";
import { GitRestClient } from "azure-devops-extension-api/Git";
import { renderAsciidoc } from "../renderer/asciidocRenderer";
import { getRepoFileContent } from "../services/gitService";
import { highlightSourceBlocks } from "../renderer/syntaxHighlighting";
import type { RenderContext } from "../types";
import "highlight.js/styles/github.css";
import { buildTree, type FileEntry } from "../hub/tree";
import { renderTree } from "../hub/treeView";
import { adocFileEntriesFromChanges, commitForPullRequest, latestIterationId } from "./prChanges";

/** Configuration Azure DevOps hands to a `ms.vss-web.tab` contribution on a pull request. */
interface PrTabConfiguration {
  repositoryId?: string;
  pullRequestId?: number;
  project?: { id?: string; name?: string };
}

function getElements() {
  const fileTree = document.getElementById("file-tree");
  const status = document.getElementById("status");
  const content = document.getElementById("content");
  if (!fileTree || !status || !content) {
    throw new Error("PR tab page is missing expected elements.");
  }
  return { fileTree, status, content };
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

async function main(): Promise<void> {
  await SDK.init({ loaded: false, applyTheme: true });
  await SDK.ready();
  await SDK.notifyLoadSucceeded();

  const { fileTree } = getElements();

  const config = SDK.getConfiguration() as PrTabConfiguration;
  const webContext = SDK.getWebContext();
  const projectId = webContext.project?.id ?? config.project?.id ?? config.project?.name;
  const repositoryId = config.repositoryId;
  const pullRequestId = config.pullRequestId;

  if (!projectId || !repositoryId || typeof pullRequestId !== "number") {
    showStatus("Could not determine the current pull request.", true);
    return;
  }

  const client = getClient(GitRestClient);

  let version: string;
  try {
    const pullRequest = await client.getPullRequestById(pullRequestId, projectId);
    const commitId = commitForPullRequest(pullRequest);
    if (!commitId) {
      showStatus("Could not determine the pull request's source commit.", true);
      return;
    }
    version = commitId;
  } catch (error) {
    console.error("[asciidoc-viewer] Failed to load pull request", error);
    showStatus(`Failed to load the pull request: ${(error as Error).message ?? error}`, true);
    return;
  }

  let entries: FileEntry[] = [];
  try {
    const iterations = await client.getPullRequestIterations(repositoryId, pullRequestId, projectId);
    const iterationId = latestIterationId(iterations);
    if (iterationId === null) {
      showStatus("This pull request has no iterations yet.");
      return;
    }

    const changes = await client.getPullRequestIterationChanges(
      repositoryId,
      pullRequestId,
      iterationId,
      projectId,
      2000,
      0
    );
    entries = adocFileEntriesFromChanges(changes.changeEntries ?? []);
  } catch (error) {
    console.error("[asciidoc-viewer] Failed to load pull request changes", error);
    showStatus(`Failed to load pull request changes: ${(error as Error).message ?? error}`, true);
    return;
  }

  if (entries.length === 0) {
    showStatus("No AsciiDoc (.adoc/.asciidoc) files were changed in this pull request.");
    return;
  }

  let selectedButton: HTMLButtonElement | null = null;
  function selectFileButton(button: HTMLButtonElement): void {
    selectedButton?.parentElement?.classList.remove("selected");
    selectedButton = button;
    button.parentElement?.classList.add("selected");
  }

  async function previewFile(filePath: string): Promise<void> {
    const context: RenderContext = {
      projectId: projectId!,
      repositoryId: repositoryId!,
      version,
      filePath
    };

    showStatus(`Loading preview for ${filePath}…`);
    try {
      const source = await getRepoFileContent(context, filePath);
      if (source === null) {
        showStatus(`Could not load file content for "${filePath}".`, true);
        return;
      }
      const html = await renderAsciidoc(source, context);
      showContent(html);
    } catch (error) {
      console.error("[asciidoc-viewer] Failed to render preview", error);
      showStatus(`Failed to render preview: ${(error as Error).message ?? error}`, true);
    }
  }

  const tree = buildTree(entries);
  fileTree.appendChild(
    renderTree(tree, (path, _kind, button) => {
      selectFileButton(button);
      void previewFile(path);
    })
  );

  const firstButton = fileTree.querySelector<HTMLButtonElement>("button[data-path]");
  if (firstButton) {
    selectFileButton(firstButton);
    await previewFile(firstButton.dataset.path!);
  }
}

main().catch((error) => {
  console.error("[asciidoc-viewer] Failed to initialize PR tab", error);
  SDK.notifyLoadFailed(error);
});
