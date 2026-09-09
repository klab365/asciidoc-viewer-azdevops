import * as SDK from "azure-devops-extension-sdk";
import { renderAsciidoc } from "./asciidocRenderer";
import { extractRenderContext } from "./optionsContext";
import type { RenderContext } from "../types";

interface ContentRenderer {
  renderContent(rawContent: string, options: unknown): void | Promise<void>;
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

function showContent(html: string): void {
  const { status, content } = getElements();
  status.hidden = true;
  content.hidden = false;
  content.innerHTML = html;
  SDK.resize();
}

async function renderContent(rawContent: string, options: unknown): Promise<void> {
  showStatus("Rendering AsciiDoc preview…");

  // Log once per load to help verify the real shape of `options` against a
  // live Azure DevOps instance (see plan.md risks) — safe to remove once
  // confirmed stable.
  console.debug("[asciidoc-viewer] renderContent options:", options);

  const context: RenderContext | null = extractRenderContext(options);

  try {
    const html = context
      ? await renderAsciidoc(rawContent, context)
      : await renderAsciidoc(rawContent, fallbackContext());
    showContent(html);
  } catch (error) {
    console.error("[asciidoc-viewer] Failed to render AsciiDoc content", error);
    showStatus(`Failed to render AsciiDoc preview: ${(error as Error).message ?? error}`, true);
  }
}

/**
 * Used when the render context (project/repo/version/path) could not be
 * determined from `options`. Includes will not resolve (every `include::`
 * will show as "unresolved"), but the main document still renders.
 */
function fallbackContext(): RenderContext {
  return { projectId: "", repositoryId: "", version: "", filePath: "/" };
}

async function main(): Promise<void> {
  await SDK.init({ loaded: false, applyTheme: true });
  await SDK.ready();

  const contentRenderer: ContentRenderer = { renderContent };
  SDK.register(SDK.getContributionId(), () => contentRenderer);

  await SDK.notifyLoadSucceeded();
}

main().catch((error) => {
  console.error("[asciidoc-viewer] Failed to initialize extension", error);
  SDK.notifyLoadFailed(error);
});
