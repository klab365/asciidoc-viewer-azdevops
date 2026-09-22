import { beforeEach, describe, expect, it, vi } from "vitest";
import { GitVersionType } from "azure-devops-extension-api/Git";
import type { RenderContext } from "../types";

const { getItemContent } = vi.hoisted(() => ({ getItemContent: vi.fn() }));
vi.mock("azure-devops-extension-sdk", () => ({ ready: vi.fn(async () => {}) }));
// The REST client imports this browser polyfill; requests are mocked below.
vi.mock("whatwg-fetch", () => ({}));
vi.mock("azure-devops-extension-api", () => ({
  getClient: () => ({ getItemContent })
}));

import { getRepoFileContent, getRepoBinaryContent } from "../services/gitService";

const sha = "fc9af360327f1ef6919422578ea36bd5a647617d";
const cases: Array<[string, string, GitVersionType | undefined, string, GitVersionType]> = [
  ["PR commit", sha, GitVersionType.Commit, sha, GitVersionType.Commit],
  ["hub branch", "main", undefined, "main", GitVersionType.Branch],
  ["prefixed branch", "GBmain", undefined, "main", GitVersionType.Branch],
  ["prefixed tag", "GTv1.0.0", undefined, "v1.0.0", GitVersionType.Tag],
  ["prefixed commit", `GC${sha}`, undefined, sha, GitVersionType.Commit],
  ["SHA-shaped explicit branch", sha, GitVersionType.Branch, sha, GitVersionType.Branch],
  ["explicit branch starting with GB", "GBdocs", GitVersionType.Branch, "GBdocs", GitVersionType.Branch]
];

describe.each([
  ["text", getRepoFileContent],
  ["binary", getRepoBinaryContent]
] as const)("%s repository content", (_kind, load) => {
  beforeEach(() => {
    getItemContent.mockReset();
    getItemContent.mockResolvedValue(new TextEncoder().encode("content").buffer);
  });

  it.each(cases)(
    "uses the correct descriptor for %s",
    async (_name, version, versionType, expectedVersion, expectedType) => {
      const context: RenderContext = {
        projectId: "project",
        repositoryId: "repo",
        filePath: "/docs/main.adoc",
        version,
        versionType
      };
      await load(context, "/docs/asset");
      expect(getItemContent).toHaveBeenCalledTimes(1);
      expect(getItemContent).toHaveBeenCalledWith(
        "repo",
        "/docs/asset",
        "project",
        undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        { version: expectedVersion, versionType: expectedType, versionOptions: 0 }
      );
    }
  );
});
