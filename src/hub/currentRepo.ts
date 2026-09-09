import * as SDK from "azure-devops-extension-sdk";
import type { IHostNavigationService } from "azure-devops-extension-api/Common";
import type { GitRepository } from "azure-devops-extension-api/Git";

const HOST_NAVIGATION_SERVICE_ID = "ms.vss-features.host-navigation-service";

/**
 * Detects the repository selected in Azure DevOps' own breadcrumb. The route
 * key varies between Azure DevOps hubs and deployments, so inspect every route
 * and query value rather than relying on a small, brittle list of key names.
 * Returns `null` only when the hub was genuinely opened without a repository
 * context, in which case the local picker remains the fallback.
 */
export async function detectCurrentRepository(repositories: GitRepository[]): Promise<GitRepository | null> {
  try {
    const navService = await SDK.getService<IHostNavigationService>(HOST_NAVIGATION_SERVICE_ID);
    const [route, queryParams] = await Promise.all([navService.getPageRoute(), navService.getQueryParams()]);

    const candidates = [...Object.values(route.routeValues ?? {}), ...Object.values(queryParams)]
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .map(decodeRouteValue);

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

function decodeRouteValue(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
