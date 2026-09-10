# AsciiDoc Viewer for Azure DevOps

An Azure DevOps extension for browsing and rendering AsciiDoc documentation
stored in Azure Repos. It runs as a dedicated **AsciiDoc Viewer** hub in
Repos and renders documents entirely in the browser.

## Usage

1. Open **Repos** in an Azure DevOps project.
2. Select **AsciiDoc Viewer** from the Repos hub navigation.
3. The repository selected in the Azure DevOps breadcrumb is used
   automatically. A repository picker is shown only when no repository
   context can be detected.
4. Use the branch picker to choose which branch of the repository to browse;
   it defaults to the repository's default branch.
5. Select an AsciiDoc document, image, or PlantUML file from the file tree.

Use the chevron on the right edge of the file tree to collapse or restore it.

Open a pull request and select its **AsciiDoc** tab to preview the
`.adoc`/`.asciidoc` files changed in that pull request, rendered at the pull
request's source commit.

## Features

- Browse `.adoc` and `.asciidoc` files from the current repository and
  branch.
- Preview AsciiDoc files changed in a pull request directly from a
  dedicated **AsciiDoc** tab on the pull request.
- Resolve local `include::` directives recursively in the same repository and
  version, including cycle detection and a readable unresolved-include
  warning.
- Render block images (`image::...[]`) from Azure Repos as data URIs. Relative
  paths, `:imagesdir:`, and images referenced from included files are
  supported.
- Preview image files (`.svg`, `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, and
  `.bmp`) directly from the file tree.
- Preview `.puml` and `.plantuml` files directly from the file tree.
- Render PlantUML, Mermaid, GraphViz, and other supported diagram blocks in
  AsciiDoc documents.
- Apply syntax highlighting to common source languages, including TypeScript,
  JavaScript, JSON, YAML, Bash, Java, C#, Python, and SQL.
- Style AsciiDoc admonitions (`NOTE`, `TIP`, `IMPORTANT`, `WARNING`, and
  `CAUTION`) for Azure DevOps light and dark themes.
- Support standard Asciidoctor features such as tables, lists, callouts, and
  a table of contents (for example, `:toc: left`).

## AsciiDoc image layout

For a document at `architecture/03-components.adoc` with images in
`architecture/images/`, set the image directory in that document:

```asciidoc
:imagesdir: images

== Components
image::component-diagram.svg[Component diagram]
```

This is important when opening the document directly. Attributes from a parent
document such as `architecture.adoc` are inherited when it uses
`include::03-components.adoc[]`, but are not available when the fragment is
opened on its own.

## Limitations

- This is a read-only viewer; editing files is not supported.
- Local includes are limited to the same Azure Repos repository and selected
  branch/commit. External and cross-repository includes are not resolved.
- Only block-image macros (`image::target[]`) are fetched from the repository;
  inline image macros (`image:target[]`) are not currently resolved.
- PlantUML and most other diagram types are rendered by
  [Kroki](https://kroki.io); Mermaid is rendered by
  [mermaid.ink](https://mermaid.ink). Diagram source is therefore sent to the
  corresponding rendering service.

## Development

The project uses [mise](https://mise.jdx.dev/) to provide the pinned Node.js
and CLI tooling.

```bash
# install the pinned tools and project dependencies
mise run install

# verify the project
mise run lint
mise run check-format
mise run test

# format source files
mise run format

# create the browser bundle in dist/
mise run build

# rebuild on changes
mise run watch

# create a VSIX package (runs a build first)
mise run package
```

## Project structure

```text
src/
  hub/                 # Azure DevOps hub, file tree, repository detection
  prTab/               # Pull request "AsciiDoc" tab (changed-file preview)
  renderer/            # Asciidoctor rendering, includes, images, diagrams, CSS
  services/gitService.ts
                        # Azure Repos Git REST access
  pages/hub.html       # hub entry page
  pages/pr-tab.html    # pull request tab entry page
  __tests__/           # Vitest tests
vss-extension.json     # Azure DevOps extension manifest
```

## Release process

The CD workflow runs when a tag named `vX.Y.Z` is pushed. The tag must match
both `package.json` and `vss-extension.json`; it builds the extension, creates
a VSIX artifact, and attempts Marketplace publishing using `MARKETPLACE_PAT`.

```bash
# after updating both version fields
git tag -a vX.Y.Z -m "Release vX.Y.Z"
git push origin main --tags
```

## License

[MIT](./LICENSE)
