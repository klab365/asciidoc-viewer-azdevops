import * as SDK from "azure-devops-extension-sdk";
import type { IHostPageLayoutService } from "azure-devops-extension-api/Common";
import { extractRenderContext } from "./actionContext";

const DIALOG_CONTRIBUTION_SHORT_ID = "asciidoc-preview-dialog";

// `CommonServiceIds.HostPageLayoutService` is a `const enum`, which can't be
// imported as a value under the `isolatedModules` TypeScript setting (needed
// for Vite/esbuild). Its value is stable and documented, so we inline it here
// as a plain string instead.
const HOST_PAGE_LAYOUT_SERVICE_ID = "ms.vss-features.host-page-layout-service";

interface MenuActionHandler {
  execute(actionContext: unknown): void | Promise<void>;
}

async function execute(actionContext: unknown): Promise<void> {
  // Logged to help verify the real shape of the menu action context against
  // a live Azure DevOps instance (its exact shape isn't publicly documented —
  // see plan.md risks). Safe to remove once confirmed stable.
  console.debug("[asciidoc-viewer] menu action context:", actionContext);

  try {
    const context = extractRenderContext(actionContext);
    const extensionContext = SDK.getExtensionContext();
    const dialogContributionId = `${extensionContext.publisherId}.${extensionContext.extensionId}.${DIALOG_CONTRIBUTION_SHORT_ID}`;
    console.debug("[asciidoc-viewer] opening dialog contribution:", dialogContributionId);

    const dialogService = await SDK.getService<IHostPageLayoutService>(
      HOST_PAGE_LAYOUT_SERVICE_ID
    );

    // Diagnostic: a plain message dialog needs no custom contribution at
    // all. If this appears but the custom dialog below stays empty, the
    // problem is isolated to resolving/loading the "asciidoc-preview-dialog"
    // contribution specifically, not IHostPageLayoutService in general.
    // Safe to remove once the custom dialog is confirmed working.
    dialogService.openMessageDialog(
      `Diagnostic: HostPageLayoutService works. About to open dialog contribution: ${dialogContributionId}`,
      { title: "AsciiDoc Preview — Diagnostic" }
    );

    dialogService.openCustomDialog(dialogContributionId, {
      title: "AsciiDoc Preview",
      configuration: {
        renderContext: context,
        // Included for debugging in case `context` is null (i.e. the action
        // context shape didn't match our extractor) — remove once verified.
        rawActionContext: context ? undefined : actionContext
      },
      lightDismiss: true
    });
  } catch (error) {
    // Without this, a rejected promise here (e.g. getService() failing to
    // resolve, or openCustomDialog throwing) would be silently swallowed by
    // the host and show up only as an empty dialog with no content and no
    // console output — this makes the failure visible.
    console.error("[asciidoc-viewer] Failed to open preview dialog", error);
    throw error;
  }
}

async function main(): Promise<void> {
  await SDK.init({ loaded: true });
  await SDK.ready();

  const handler: MenuActionHandler = { execute };
  SDK.register(SDK.getContributionId(), () => handler);

  await SDK.notifyLoadSucceeded();
}

main().catch((error) => {
  console.error("[asciidoc-viewer] Failed to initialize preview action", error);
  SDK.notifyLoadFailed(error);
});
