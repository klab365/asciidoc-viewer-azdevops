import { describe, expect, it } from "vitest";
import { extractRenderContext } from "../action/actionContext";

describe("extractRenderContext", () => {
  it("extracts the render context from the verified live source-item-menu actionContext shape", () => {
    const actionContext = {
      gitRepository: {
        id: "653246ff-6639-4c1f-b9f2-e0a6ac60f4e3",
        name: "Demo",
        url: "https://dev.azure.com/klab365/9a1fee1f-d750-4cab-a.../repositories/653246ff-6639-4c1f-b9f2-e0a6ac60f4e3",
        project: { id: "9a1fee1f-d750-4cab-abcd-123456789abc", name: "Demo" },
        defaultBranch: "refs/heads/main"
      },
      item: {
        sourceProvider: "Git",
        path: "/test.adoc",
        item: {},
        url: "?path=/test.adoc&version=GBmain"
      },
      version: "main",
      getSourceItemContext: () => undefined
    };

    expect(extractRenderContext(actionContext)).toEqual({
      projectId: "9a1fee1f-d750-4cab-abcd-123456789abc",
      repositoryId: "653246ff-6639-4c1f-b9f2-e0a6ac60f4e3",
      version: "main",
      filePath: "/test.adoc"
    });
  });

  it("returns null for an unrecognized shape", () => {
    expect(extractRenderContext({ foo: "bar" })).toBeNull();
  });

  it("returns null for non-object input", () => {
    expect(extractRenderContext(null)).toBeNull();
    expect(extractRenderContext(undefined)).toBeNull();
    expect(extractRenderContext("string")).toBeNull();
  });

  it("falls back to heuristic extraction for a differently-shaped context", () => {
    const actionContext = {
      projectId: "proj-1",
      repositoryId: "repo-1",
      version: "main",
      path: "/docs/file.adoc"
    };

    expect(extractRenderContext(actionContext)).toEqual({
      projectId: "proj-1",
      repositoryId: "repo-1",
      version: "main",
      filePath: "/docs/file.adoc"
    });
  });
});
