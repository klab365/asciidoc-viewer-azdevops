# AsciiDoc Viewer for Azure DevOps

Azure DevOps extension that lets you preview `.adoc` / `.asciidoc` files
directly from Azure Repos — similar to the built-in Markdown preview. Local
`include::` directives (files within the same repository) are resolved and
rendered inline.

> Status: early development, not yet published to the Marketplace. See
> [`plan.md`](./plan.md) for the full implementation plan and current
> progress.

## Features (planned)

- Right-click an `.adoc`/`.asciidoc` file in Azure Repos → **AsciiDoc
  Preview** → opens a dialog with the rendered document.
- Resolves local `include::` directives against the same repository/branch
  (recursively, with cycle detection).
- Rendering happens entirely client-side via [Asciidoctor.js](https://asciidoctor.org/docs/asciidoctor.js/)
  — no backend service required.

## Why not a native "Preview" tab like Markdown?

Azure DevOps does not expose a public extension point to add a preview tab to
the built-in file view (the Markdown preview is a native, non-extensible
feature). The closest achievable UX using documented, public Azure DevOps
extensibility points is a context-menu action that opens a dialog. See
`plan.md` for details on the extension points that were evaluated.

## Development

This project uses [mise](https://mise.jdx.dev/) to pin tool versions and run
tasks — no global installs required.

```bash
# install pinned tools (Node, tfx-cli, vite) + npm dependencies
mise run install

# build the extension bundle
mise run build

# build in watch mode
mise run watch

# package as .vsix (requires a build first)
mise run package

# lint / test
mise run lint
mise run test
```

### Project structure

```
src/
  types.ts                 # shared types + path helpers for include resolution
  services/
    gitService.ts          # fetches file content from Azure Repos via REST
  menuAction/
    index.ts               # context-menu action (source-item-menu contribution)
  renderer/
    index.html             # dialog content page
    index.ts               # SDK init, orchestrates fetch + render
    includeResolver.ts      # resolves local include:: directives
    asciidocRenderer.ts     # Asciidoctor.js rendering
    styles/main.css
vss-extension.json          # extension manifest (contributions, metadata)
mise.toml                   # pinned tools + tasks
```

## Publishing

This extension is intended to be published **publicly** on the Visual Studio
Marketplace, so anyone can install it in their own Azure DevOps organization.
See `plan.md` for the publishing checklist (publisher account, license,
versioning, marketplace review).

### CI/CD

- **CI** (`.github/workflows/ci.yml`): runs on every push/PR to `main` —
  install, lint, test, build, and a package **dry-run** (`.vsix` built and
  uploaded as an artifact, but never published).
- **CD** (`.github/workflows/cd.yml`): runs only when a tag `vX.Y.Z` is
  pushed. It verifies the tag matches `package.json`'s `version` field, then
  builds and publishes to the Marketplace via `tfx extension publish`.
  Requires a `MARKETPLACE_PAT` repository secret.

Release flow: bump `version` in `package.json` → commit → `git tag vX.Y.Z` →
`git push --tags`. No automatic publish happens on a plain `main` push —
publishing is always an explicit, tagged action.

## License

[MIT](./LICENSE)
