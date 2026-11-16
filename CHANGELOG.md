# Changelog

All notable changes to this project are documented in this file.

## [1.5.2](https://github.com/klab365/asciidoc-viewer-azdevops/compare/asciidoc-viewer-azdevops-v1.5.1...asciidoc-viewer-azdevops-v1.5.2) (2026-11-16)


### Bug Fixes

* Resolve inline and table-cell images ([94c37bf](https://github.com/klab365/asciidoc-viewer-azdevops/commit/94c37bf4e5083afb85d7de29517564e3711cafb6))

## [1.5.1](https://github.com/klab365/asciidoc-viewer-azdevops/compare/asciidoc-viewer-azdevops-v1.5.0...asciidoc-viewer-azdevops-v1.5.1) (2026-11-10)


### Bug Fixes

* support release please tag publishing ([e9d7208](https://github.com/klab365/asciidoc-viewer-azdevops/commit/e9d720898420fb59228fc66e937400451dd3c2dc))

## [1.5.0](https://github.com/klab365/asciidoc-viewer-azdevops/compare/asciidoc-viewer-azdevops-v1.4.0...asciidoc-viewer-azdevops-v1.5.0) (2026-11-10)


### Features

* add AsciiDoc preview tab for pull requests ([6805468](https://github.com/klab365/asciidoc-viewer-azdevops/commit/6805468c5eea4e295741217c60464c23914d1fc7))
* add pull request AsciiDoc preview ([59cb55c](https://github.com/klab365/asciidoc-viewer-azdevops/commit/59cb55ce28c8dc70fabc6892e364ae185cf7005f))
* add support for rendering LaTeX formulas with KaTeX ([cb9f94f](https://github.com/klab365/asciidoc-viewer-azdevops/commit/cb9f94f3ea980157e37f8d26324e4e2d01b3f58c))
* add support for rendering LaTeX formulas with KaTeX ([94ea3b6](https://github.com/klab365/asciidoc-viewer-azdevops/commit/94ea3b669b0b7a644bd3ac309e9246f2eca2b96e)), closes [#11](https://github.com/klab365/asciidoc-viewer-azdevops/issues/11)


### Bug Fixes

* align hub design with Azure DevOps theming ([8d50f67](https://github.com/klab365/asciidoc-viewer-azdevops/commit/8d50f67fbd26733528103de8ef12505547217d51)), closes [#2](https://github.com/klab365/asciidoc-viewer-azdevops/issues/2)
* avoid release manifest formatting conflicts ([53c889a](https://github.com/klab365/asciidoc-viewer-azdevops/commit/53c889ae96f7b1deb2594c84c132f486313c178a))
* correct release metadata and automate releases ([cc3a6c0](https://github.com/klab365/asciidoc-viewer-azdevops/commit/cc3a6c01a89573d51aa022e798cd03dd4da0eda2))
* **deps:** address minimatch vulnerability ([eb551e9](https://github.com/klab365/asciidoc-viewer-azdevops/commit/eb551e91ef77af5c2ff016860f55ed516ba905a9))
* **deps:** address minimatch vulnerability ([45d60e2](https://github.com/klab365/asciidoc-viewer-azdevops/commit/45d60e28a6aacdf402588a6242707a1b1a017a5d))
* **deps:** combine Vite and DOMPurify security updates ([fd676ee](https://github.com/klab365/asciidoc-viewer-azdevops/commit/fd676ee0ac09cf812899bbf5dffbaba8b6268c63))
* **deps:** retain compatible SDK and TypeScript versions ([c8a30ea](https://github.com/klab365/asciidoc-viewer-azdevops/commit/c8a30ea73c047423547e76ff55a95bbf68cc31f8))
* **deps:** update Mermaid to resolve KaTeX alert ([dc4c8ef](https://github.com/klab365/asciidoc-viewer-azdevops/commit/dc4c8ef1e54258369e33c2c6af33a96e11e49bf4))
* persist initial branch in hub URL ([01ec85d](https://github.com/klab365/asciidoc-viewer-azdevops/commit/01ec85d83d5b66759af5f9369d09a47e822c67b1))
* persist initial branch in hub URL ([0166f44](https://github.com/klab365/asciidoc-viewer-azdevops/commit/0166f44b3c2263ac97071dc17237f72b093b74bf))
* remove useless entries initialization ([13a6930](https://github.com/klab365/asciidoc-viewer-azdevops/commit/13a6930bed2a32f53561e1cc9ba3d3a956513a4a))
* remove useless entries initialization ([7b95eb5](https://github.com/klab365/asciidoc-viewer-azdevops/commit/7b95eb5120c5d71fb9a0aa6ae4829ee4d305f938))
* scale down oversized images to page width ([9cf66be](https://github.com/klab365/asciidoc-viewer-azdevops/commit/9cf66bec1d8d6c8c829b7ac7670fe59259885361))
* scale down oversized images to page width ([65c6245](https://github.com/klab365/asciidoc-viewer-azdevops/commit/65c6245d495aae827b57a13b2eb1152b71dca14c)), closes [#3](https://github.com/klab365/asciidoc-viewer-azdevops/issues/3)
* stop blocking Azure DevOps host spinner during hub load ([f2f640d](https://github.com/klab365/asciidoc-viewer-azdevops/commit/f2f640d602aa0c685635a04b511bd9ad469a9991))
* streamline adoc icon definition for consistency ([760f1da](https://github.com/klab365/asciidoc-viewer-azdevops/commit/760f1dae05e67ba2793fb62d385d8fd42b8e6178))
* streamline adoc icon definition for consistency ([d497588](https://github.com/klab365/asciidoc-viewer-azdevops/commit/d497588670225ff0bf215b2a719a3356aebe854a))

## [1.4.0] - 2026-11-10

### Added

- Automatically apply ancestor `.asciidoctorconfig` files from the repository
  root through the document's folder in hub and pull request previews. Config
  includes resolve relative to their config file and use the document's branch
  or commit.

## [1.3.0] - 2026-10-14

### Added

- Preserve repository, branch, and file selections in URL parameters, allowing
  the hub to be opened directly at a specific repository, branch, and file.

### Security

- Upgrade Mermaid to 12.2.0, which resolves the vulnerable transitive KaTeX
  dependency (GHSA-238p-pmpm-9mq7).

## [1.2.0]

### Added

- Render inline and block LaTeX formulas written with Asciidoctor's
  `latexmath` / `stem: latexmath` syntax using KaTeX.
- Preview AsciiDoc files directly on a pull request's new **AsciiDoc** tab.
  The tab lists the `.adoc`/`.asciidoc` files changed in the pull request and
  renders the selected file at the pull request's source commit (falling
  back to the target commit), reusing the same rendering pipeline as the
  repository hub (includes, images, diagrams, syntax highlighting).

## [1.1.1] - 2026-09-10

### Fixed

- Notify Azure DevOps that the hub finished loading as soon as its UI shell
  is ready, instead of only after repositories, branches, the file tree, and
  a possible deep-linked file preview had all loaded. Previously this could
  keep Azure DevOps's host-level loading spinner visible for several
  seconds; the hub's own status messages now report load progress instead.

## [1.1.0] - 2026-09-10

### Added

- Branch picker in the hub toolbar, so a file can be previewed from any
  branch of the selected repository, not just its default branch.

### Fixed

- Scale down oversized images so they never render wider than the page.
- Align the hub's look and feel with Azure DevOps theming: replaced emoji
  file-tree icons with monochrome icons that follow the current theme's
  colours, restyled the toolbar dropdowns to match Azure DevOps inputs, and
  removed the artificial content width cap so previews use the full panel
  width like other Azure DevOps hubs.

## [1.0.1] - 2026-09-09

### Fixed

- Include Marketplace screenshots as addressable VSIX assets so they render in
  the extension overview.
- Simplify the Marketplace description.

## [1.0.0] - 2026-09-09

### Added

- Dedicated Azure Repos hub for browsing and rendering AsciiDoc files.
- Recursive local `include::` resolution with cycle detection.
- Repository-backed block-image rendering, including support for `:imagesdir:`.
- Image-file previews and direct PlantUML (`.puml` / `.plantuml`) previews.
- Diagram rendering for PlantUML, Mermaid, GraphViz, and other Kroki-supported
  diagram blocks.
- Syntax highlighting for common source languages.
- Light- and dark-theme admonition styling.
- Collapsible repository file tree and automatic repository detection from the
  Azure DevOps breadcrumb.
- Updated hub and Marketplace icons.
- Published the extension publicly on the Visual Studio Marketplace.
- Updated documentation to reflect the current hub-based experience,
  capabilities, and diagram-rendering privacy considerations.
