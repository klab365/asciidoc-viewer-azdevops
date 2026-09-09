import * as SDK from "azure-devops-extension-sdk";
import { renderAsciidoc } from "./asciidocRenderer";
import { getRepoFileContent } from "../services/gitService";
import type { RenderContext } from "../types";

interface DialogConfiguration {
  renderContext?: RenderContext | null;
  rawActionContext?: unknown;
}

function getElements() {
  const status = document.getElementById("status");
  const content = document.getElementById("content");
  if (!status || !content) {
    throw new Error("Renderer page is missing expected #status/#content elements.");
  }
  return { status, content };
}

function showStatus(message: string, isError = false): void {
  const { status, content } = getElements();
  status.hidden = false;
  status.textContent = message;
  status.classList.toggle("error", isError);
  content.hidden = true;
}

function showDebugContext(rawActionContext: unknown): void {
  const { status } = getElements();
  const pre = document.createElement("pre");
  pre.textContent = JSON.stringify(rawActionContext, null, 2);
  status.appendChild(pre);
}

function showContent(html: string): void {
  const { status, content } = getElements();
  status.hidden = true;
  content.hidden = false;
  content.innerHTML = html;
  SDK.resize();
}

async function run(): Promise<void> {
  await SDK.init({ loaded: false, applyTheme: true });
  await SDK.ready();

  const config = SDK.getConfiguration() as DialogConfiguration;
  const context = config.renderContext ?? null;

  if (!context) {
    showStatus(
      "Could not determine which file to preview (unrecognized menu action context). Raw context for debugging:",
      true
    );
    showDebugContext(config.rawActionContext);
    await SDK.notifyLoadSucceeded();
    return;
  }

  showStatus("Loading preview…");

  try {
    const mainContent = await getRepoFileContent(context, context.filePath);
    if (mainContent === null) {
      showStatus(`Could not load file content for "${context.filePath}".`, true);
    } else {
      const html = await renderAsciidoc(mainContent, context);
      showContent(html);
    }
  } catch (error) {
    console.error("[asciidoc-viewer] Failed to render AsciiDoc content", error);
    showStatus(`Failed to render AsciiDoc preview: ${(error as Error).message ?? error}`, true);
  }

  await SDK.notifyLoadSucceeded();
}

run().catch((error) => {
  console.error("[asciidoc-viewer] Failed to initialize preview dialog", error);
  SDK.notifyLoadFailed(error);
});
