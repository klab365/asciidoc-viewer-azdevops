import * as SDK from "azure-devops-extension-sdk";
import type { IHostNavigationService } from "azure-devops-extension-api/Common";
import type { GitRepository } from "azure-devops-extension-api/Git";

const HOST_NAVIGATION_SERVICE_ID = "ms.vss-features.host-navigation-service";

/**
 * Tries to detect which repository this hub was opened from (it's contributed
 * to `ms.vss-code-web.code-hub-group`, which — like the built-in "Files"/
 * "Commits" hubs — appears to be opened while a specific repository is
 * already selected). The exact route/query param shape isn't publicly
 * documented, so this logs what it finds and matches against a handful of
 * plausible keys; returns `null` if nothing matches (caller should then fall
 * back to letting the user pick a repository manually).
 */
export async function detectCurrentRepository(repositories: GitRepository[]): Promise<GitRepository | null> {
  try {
    const navService = await SDK.getService<IHostNavigationService>(HOST_NAVIGATION_SERVICE_ID);
    const [route, queryParams] = await Promise.all([navService.getPageRoute(), navService.getQueryParams()]);

    console.debug("[asciidoc-viewer] page route:", route);
    console.debug("[asciidoc-viewer] query params:", queryParams);

    const candidates = [
      route.routeValues?.["GitRepositoryName"],
      route.routeValues?.["repository"],
      route.routeValues?.["Parameters"],
      route.routeValues?.["parameters"],
      queryParams["repository"],
      queryParams["repositoryId"]
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    for (const candidate of candidates) {
      const match = repositories.find(
        (repo) => repo.id === candidate || repo.name.toLowerCase() === candidate.toLowerCase()
      );
      if (match) {
        return match;
      }
    }
  } catch (error) {
    console.warn("[asciidoc-viewer] Could not detect the current repository from the page route", error);
  }

  return null;
}
