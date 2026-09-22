---
name: prepare-release
description: |
  Prepare and publish a versioned release of the AsciiDoc Viewer Azure DevOps extension. Use when asked to cut, prepare, validate, tag, or recover a release.
---

# Prepare Release

Use this process for releases of `asciidoc-viewer-azdevops`. A pushed tag matching `v*.*.*` starts `.github/workflows/cd.yml`, which validates that the tag, `package.json`, and `vss-extension.json` have exactly the same version.

## Rules

- Treat the tag version without its leading `v` as the release version: `v1.2.0` means `1.2.0`.
- Update all three version records before creating the release commit:
  - `package.json`
  - `package-lock.json` (both root `version` fields)
  - `vss-extension.json`
- Add release notes to `CHANGELOG.md`.
- Never create or push the release tag until the version commit is committed and pushed. The tag must point at that commit.
- Do not force-move or delete an existing remote release tag without explicit user approval. It may already have triggered a Marketplace publication.

## Procedure

1. **Choose and inspect the version.** Confirm the target is a valid semantic version and has not already been published.

   ```bash
   VERSION=1.2.0
   git status --short
   git fetch --tags origin
   git tag --list "v${VERSION}"
   git ls-remote --tags origin "refs/tags/v${VERSION}"
   ```

   Start from a clean worktree unless the user explicitly asks to include existing changes. Stop and ask if the tag already exists remotely.

2. **Update release metadata.** Update `package.json`, the root package entry in `package-lock.json`, and `vss-extension.json` to `$VERSION`. Prefer npm to keep the lockfile consistent, without making a tag:

   ```bash
   npm version "$VERSION" --no-git-tag-version
   ```

   Then update `vss-extension.json` and add a `## [$VERSION] - YYYY-MM-DD` section to `CHANGELOG.md` describing user-visible changes. Verify all records:

   ```bash
   node -e 'const p=require("./package.json"); const l=require("./package-lock.json"); const m=require("./vss-extension.json"); const v=process.argv[1]; for (const [file, actual] of Object.entries({"package.json":p.version,"package-lock.json":l.version,"package-lock.json packages[\"\"].version":l.packages[""].version,"vss-extension.json":m.version})) { if (actual !== v) throw new Error(`${file}: expected ${v}, got ${actual}`); console.log(`${file}: ${actual}`) }' "$VERSION"
   ```

3. **Run the release checks locally.** These match CI's quality checks, and packaging verifies the manifest can produce a VSIX.

   ```bash
   mise run lint
   mise run check-format
   mise run test
   mise run build
   mise exec -- tfx extension create \
     --manifest-globs vss-extension.json \
     --override "{\"version\":\"${VERSION}\"}" \
     --output-path "asciidoc-viewer-azdevops-${VERSION}.vsix"
   ```

   Remove the generated `.vsix` before committing unless it is deliberately being retained:

   ```bash
   rm -f "asciidoc-viewer-azdevops-${VERSION}.vsix"
   ```

4. **Commit and merge the release metadata.** Review the diff, commit only the intended metadata and changelog changes, push the branch, and wait for the main-branch CI workflow to pass. If using a PR, merge it first and release from the resulting `main` commit.

   ```bash
   git diff --check
   git diff -- package.json package-lock.json vss-extension.json CHANGELOG.md
   git add package.json package-lock.json vss-extension.json CHANGELOG.md
   git commit -m "chore: bump version to ${VERSION}"
   git push origin HEAD
   ```

5. **Tag the verified release commit.** Update local `main`, confirm its metadata still matches, then create and push an annotated tag.

   ```bash
   git switch main
   git pull --ff-only origin main
   # Re-run the version verification command from step 2.
   git tag -a "v${VERSION}" -m "Release v${VERSION}"
   git push origin "v${VERSION}"
   ```

6. **Monitor delivery.** The CD workflow tests, builds, packages, uploads a 90-day VSIX artifact, and attempts Marketplace publication. Confirm the GitHub Actions run and Marketplace listing. If automatic publication fails, download the named VSIX artifact from the workflow and upload it manually at the publisher portal shown in the workflow logs.

## Failed tag validation

If CD reports, for example, `Tag (v1.2.0) does not match package.json version (1.1.1)`, the tag was created before the version metadata commit. Make the metadata commit, run validation, and ask before changing the existing remote tag. If approved and the release was not published, delete the remote tag, delete the local tag, then recreate it at the corrected commit:

```bash
git push origin --delete "v${VERSION}"
git tag -d "v${VERSION}"
git tag -a "v${VERSION}" -m "Release v${VERSION}"
git push origin "v${VERSION}"
```

If the tag might have published successfully, do not retag it; choose the next version and follow the normal procedure.
