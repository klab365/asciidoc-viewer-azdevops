import * as SDK from "azure-devops-extension-sdk";
import type { IHostNavigationService } from "azure-devops-extension-api/Common";

const HOST_NAVIGATION_SERVICE_ID = "ms.vss-features.host-navigation-service";
const PATH_QUERY_PARAM = "asciidocPath";
const BRANCH_QUERY_PARAM = "asciidocBranch";

let cachedNavService: Promise<IHostNavigationService> | null = null;

function getNavService(): Promise<IHostNavigationService> {
  cachedNavService ??= SDK.getService<IHostNavigationService>(HOST_NAVIGATION_SERVICE_ID);
  return cachedNavService;
}

/** Reads the currently selected file path from the URL, if present. */
export async function readSelectedPathFromUrl(): Promise<string | null> {
  const navService = await getNavService();
  const params = await navService.getQueryParams();
  const value = params[PATH_QUERY_PARAM];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Reflects the currently selected file path in the URL (without a page reload), so it's shareable/bookmarkable. */
export async function writeSelectedPathToUrl(path: string): Promise<void> {
  const navService = await getNavService();
  navService.setQueryParams({ [PATH_QUERY_PARAM]: path });
}

/** Reads the currently selected branch name from the URL, if present. */
export async function readSelectedBranchFromUrl(): Promise<string | null> {
  const navService = await getNavService();
  const params = await navService.getQueryParams();
  const value = params[BRANCH_QUERY_PARAM];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/** Reflects the currently selected branch name in the URL (without a page reload), so it's shareable/bookmarkable. */
export async function writeSelectedBranchToUrl(branch: string): Promise<void> {
  const navService = await getNavService();
  navService.setQueryParams({ [BRANCH_QUERY_PARAM]: branch });
}
