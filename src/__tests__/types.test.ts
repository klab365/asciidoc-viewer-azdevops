import { describe, expect, it } from "vitest";
import { dirnameOf, resolveRepoRelativePath } from "../types";

describe("dirnameOf", () => {
  it("returns the parent directory of a nested file", () => {
    expect(dirnameOf("/docs/chapters/ch1.adoc")).toBe("/docs/chapters");
  });

  it("returns root for a top-level file", () => {
    expect(dirnameOf("/main.adoc")).toBe("/");
  });

  it("normalizes a path without a leading slash", () => {
    expect(dirnameOf("docs/main.adoc")).toBe("/docs");
  });
});

describe("resolveRepoRelativePath", () => {
  it("resolves a simple relative path", () => {
    expect(resolveRepoRelativePath("/docs", "chapters/ch1.adoc")).toBe("/docs/chapters/ch1.adoc");
  });

  it("resolves '..' segments", () => {
    expect(resolveRepoRelativePath("/docs/chapters", "../shared/note.adoc")).toBe("/docs/shared/note.adoc");
  });

  it("resolves './' segments", () => {
    expect(resolveRepoRelativePath("/docs", "./chapters/ch1.adoc")).toBe("/docs/chapters/ch1.adoc");
  });

  it("treats a leading '/' as repo-root-relative", () => {
    expect(resolveRepoRelativePath("/docs/chapters", "/shared/note.adoc")).toBe("/shared/note.adoc");
  });

  it("returns null for absolute URLs", () => {
    expect(resolveRepoRelativePath("/docs", "https://example.com/note.adoc")).toBeNull();
    expect(resolveRepoRelativePath("/docs", "http://example.com/note.adoc")).toBeNull();
  });

  it("returns null when '..' escapes the repository root", () => {
    expect(resolveRepoRelativePath("/", "../outside.adoc")).toBeNull();
    expect(resolveRepoRelativePath("/docs", "../../outside.adoc")).toBeNull();
  });
});
