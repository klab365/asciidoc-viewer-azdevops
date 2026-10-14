import { beforeEach, describe, expect, it, vi } from "vitest";

const { getService, getQueryParams, setQueryParams } = vi.hoisted(() => ({
  getService: vi.fn(),
  getQueryParams: vi.fn(),
  setQueryParams: vi.fn()
}));

vi.mock("azure-devops-extension-sdk", () => ({ getService }));

import { writeSelectedRepositoryAndBranchToUrl } from "../hub/urlState";

describe("writeSelectedRepositoryAndBranchToUrl", () => {
  beforeEach(() => {
    getQueryParams.mockReset();
    setQueryParams.mockReset();
    getService.mockResolvedValue({ getQueryParams, setQueryParams });
  });

  it("writes the initial repository and branch together", async () => {
    await writeSelectedRepositoryAndBranchToUrl("repository-id", "main");

    expect(setQueryParams).toHaveBeenCalledWith({
      asciidocRepository: "repository-id",
      asciidocBranch: "main"
    });
  });
});
