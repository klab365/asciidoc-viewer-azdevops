import { describe, expect, it } from "vitest";
import { branchNameFromRef, branchNamesFromRefs, pickInitialBranch } from "../hub/branches";

describe("branchNameFromRef", () => {
  it("strips the refs/heads/ prefix", () => {
    expect(branchNameFromRef({ name: "refs/heads/main" })).toBe("main");
    expect(branchNameFromRef({ name: "refs/heads/feature/foo" })).toBe("feature/foo");
  });

  it("leaves names without the prefix untouched", () => {
    expect(branchNameFromRef({ name: "main" })).toBe("main");
  });
});

describe("branchNamesFromRefs", () => {
  it("maps and sorts refs alphabetically", () => {
    const refs = [{ name: "refs/heads/zeta" }, { name: "refs/heads/main" }, { name: "refs/heads/alpha" }];
    expect(branchNamesFromRefs(refs)).toEqual(["alpha", "main", "zeta"]);
  });

  it("returns an empty array for no refs", () => {
    expect(branchNamesFromRefs([])).toEqual([]);
  });
});

describe("pickInitialBranch", () => {
  const branchNames = ["develop", "main", "release/1.0"];

  it("prefers a branch requested via deep link, if it exists", () => {
    expect(pickInitialBranch(branchNames, "develop", "main")).toBe("develop");
  });

  it("falls back to the default branch when no branch was requested", () => {
    expect(pickInitialBranch(branchNames, null, "main")).toBe("main");
  });

  it("falls back to the default branch when the requested branch does not exist", () => {
    expect(pickInitialBranch(branchNames, "does-not-exist", "main")).toBe("main");
  });

  it("falls back to the first branch when neither requested nor default branch exist", () => {
    expect(pickInitialBranch(branchNames, "does-not-exist", "trunk")).toBe("develop");
  });
});
