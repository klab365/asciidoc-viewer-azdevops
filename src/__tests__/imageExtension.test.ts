import { describe, expect, it, vi, beforeEach } from "vitest";
import type { RenderContext } from "../types";

vi.mock("../services/gitService", () => ({
  getRepoFileContent: vi.fn(async () => null),
  getRepoBinaryContent: vi.fn(async (_context: RenderContext, path: string) => {
    if (path === "/docs/diagram.svg" || path === "/docs/images/diagram.svg") {
      return new TextEncoder().encode("<svg>fake</svg>").buffer;
    }
    return null;
  })
}));

const { renderAsciidoc } = await import("../renderer/asciidocRenderer");
const { getRepoBinaryContent, getRepoFileContent } = await import("../services/gitService");

function contextFor(filePath: string): RenderContext {
  return { projectId: "proj", repositoryId: "repo", version: "main", filePath };
}

describe("image resolution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getRepoFileContent).mockResolvedValue(null);
  });

  it("replaces a block image's src with a data URI fetched from the repo", async () => {
    const source = "= Doc\n\nimage::diagram.svg[]\n";
    const html = await renderAsciidoc(source, contextFor("/docs/main.adoc"));

    expect(html).toContain('src="data:image/svg+xml;base64,');
    expect(html).not.toContain('src="diagram.svg"');
  });

  it("resolves images relative to an AsciiDoc imagesdir", async () => {
    const source = "= Doc\n:imagesdir: images\n\nimage::diagram.svg[]\n";
    const html = await renderAsciidoc(source, contextFor("/docs/main.adoc"));

    expect(getRepoBinaryContent).toHaveBeenCalledWith(expect.anything(), "/docs/images/diagram.svg");
    expect(html).toContain('src="data:image/svg+xml;base64,');
  });

  it("resolves both table-cell images and a following block image without mixing their targets", async () => {
    const source = `= Doc
:imagesdir: images

[cols="45%,10%,45%",frame=none,grid=none]
|===
a|
image::diagram.svg[First,width=144,height=316]
^.^|OR
a|
image::missing.png[Second,width=147,height=318]
|===

image::diagram.svg[Following]
`;
    const html = await renderAsciidoc(source, contextFor("/docs/main.adoc"));

    expect(html).toContain("<table");
    expect(html).toContain('src="data:image/svg+xml;base64,PHN2Zz5mYWtlPC9zdmc+" alt="First" width="144" height="316"');
    expect(html).toMatch(/src="data:image\/svg\+xml;utf8,[^"]*missing\.png[^"]*" alt="Second"/);
    expect(html).toContain('src="data:image/svg+xml;base64,PHN2Zz5mYWtlPC9zdmc+" alt="Following"');
    expect(html).not.toContain("asciidoc-viewer-image-placeholder");
    expect(getRepoBinaryContent).toHaveBeenCalledTimes(2);
    expect(getRepoBinaryContent).toHaveBeenCalledWith(expect.anything(), "/docs/images/diagram.svg");
    expect(getRepoBinaryContent).toHaveBeenCalledWith(expect.anything(), "/docs/images/missing.png");
  });

  it("resolves images across multiple tables without mixing their targets", async () => {
    const source = `= Doc
:imagesdir: images

[cols="a"]
|===
|image::diagram.svg[First table]
|===

[cols="a"]
|===
|image::missing.png[Second table]
|===

[cols="a"]
|===
|image::diagram.svg[Third table]
|===
`;
    const html = await renderAsciidoc(source, contextFor("/docs/main.adoc"));

    expect(html.match(/<table/g)).toHaveLength(3);
    expect(html).toContain('src="data:image/svg+xml;base64,PHN2Zz5mYWtlPC9zdmc+" alt="First table"');
    expect(html).toMatch(/src="data:image\/svg\+xml;utf8,[^"]*missing\.png[^"]*" alt="Second table"/);
    expect(html).toContain('src="data:image/svg+xml;base64,PHN2Zz5mYWtlPC9zdmc+" alt="Third table"');
    expect(html).not.toContain("asciidoc-viewer-image-placeholder");
    expect(getRepoBinaryContent).toHaveBeenCalledTimes(2);
    expect(getRepoBinaryContent).toHaveBeenCalledWith(expect.anything(), "/docs/images/diagram.svg");
    expect(getRepoBinaryContent).toHaveBeenCalledWith(expect.anything(), "/docs/images/missing.png");
  });

  it("resolves images in nested AsciiDoc tables", async () => {
    const source = `= Doc
:imagesdir: images

[cols="a"]
|===
|
[cols="a"]
!===
!
image::diagram.svg[Nested]
!===
|===
`;
    const html = await renderAsciidoc(source, contextFor("/docs/main.adoc"));

    expect(html).toContain('src="data:image/svg+xml;base64,PHN2Zz5mYWtlPC9zdmc+" alt="Nested"');
    expect(getRepoBinaryContent).toHaveBeenCalledTimes(1);
    expect(getRepoBinaryContent).toHaveBeenCalledWith(expect.anything(), "/docs/images/diagram.svg");
  });

  it("resolves table-cell images relative to their included file", async () => {
    vi.mocked(getRepoFileContent).mockImplementation(async (_context, path) =>
      path === "/docs/chapters/table.adoc" ? '[cols="a"]\n|===\n|\nimage::diagram.svg[Included]\n|===\n' : null
    );
    const source = "= Doc\n:imagesdir: ../images\n\ninclude::chapters/table.adoc[]\n";
    const html = await renderAsciidoc(source, contextFor("/docs/main.adoc"));

    expect(html).toContain('src="data:image/svg+xml;base64,PHN2Zz5mYWtlPC9zdmc+" alt="Included"');
    expect(getRepoBinaryContent).toHaveBeenCalledTimes(1);
    expect(getRepoBinaryContent).toHaveBeenCalledWith(expect.anything(), "/docs/images/diagram.svg");
  });

  it("resolves inline icons, preserving their size and sharing fetches with block images", async () => {
    const source = `= Doc
:imagesdir: images

The icon (image:diagram.svg[On,width=15,height=15] if on
/image:missing.png[Off,width=14,height=16] if off) changes.

image::diagram.svg[Screen]
`;
    const html = await renderAsciidoc(source, contextFor("/docs/main.adoc"));

    expect(html).toContain('src="data:image/svg+xml;base64,PHN2Zz5mYWtlPC9zdmc+" alt="On" width="15" height="15"');
    expect(html).toMatch(/src="data:image\/svg\+xml;utf8,[^"]*missing\.png[^"]*" alt="Off" width="14" height="16"/);
    expect(html).toContain('src="data:image/svg+xml;base64,PHN2Zz5mYWtlPC9zdmc+" alt="Screen"');
    expect(getRepoBinaryContent).toHaveBeenCalledTimes(2);
  });

  it("resolves inline images in ordinary table cells, including headers", async () => {
    const source = `= Doc
:imagesdir: images

[cols="1,1",options="header"]
|===
|image:diagram.svg[Header] |Heading
|image:diagram.svg[Body] |image:https://example.com/pic.png[External]
|===
`;
    const html = await renderAsciidoc(source, contextFor("/docs/main.adoc"));

    expect(html).toContain('src="data:image/svg+xml;base64,PHN2Zz5mYWtlPC9zdmc+" alt="Header"');
    expect(html).toContain('src="data:image/svg+xml;base64,PHN2Zz5mYWtlPC9zdmc+" alt="Body"');
    expect(html).toContain('src="https://example.com/pic.png"');
    expect(getRepoBinaryContent).toHaveBeenCalledTimes(1);
  });

  it("resolves inline images relative to their included file", async () => {
    vi.mocked(getRepoFileContent).mockImplementation(async (_context, path) =>
      path === "/docs/chapters/icons.adoc" ? "The image:diagram.svg[Included] icon.\n\n" : null
    );
    const source = "= Doc\n:imagesdir: ../images\n\ninclude::chapters/icons.adoc[]\n";
    const html = await renderAsciidoc(source, contextFor("/docs/main.adoc"));

    expect(html).toContain('src="data:image/svg+xml;base64,PHN2Zz5mYWtlPC9zdmc+" alt="Included"');
    expect(getRepoBinaryContent).toHaveBeenCalledWith(expect.anything(), "/docs/images/diagram.svg");
  });

  it("keeps image placeholders distinct when a document contains more than ten images", async () => {
    const images = Array.from(
      { length: 12 },
      (_, index) => `image:${index === 10 ? "missing.png" : "diagram.svg"}[Icon ${index}]`
    ).join("\n\n");
    const html = await renderAsciidoc(`= Doc\n\n${images}\n`, contextFor("/docs/main.adoc"));

    expect(html).toMatch(/src="data:image\/svg\+xml;utf8,[^"]*missing\.png[^"]*" alt="Icon 10"/);
    expect(html).toContain('src="data:image/svg+xml;base64,PHN2Zz5mYWtlPC9zdmc+" alt="Icon 11"');
    expect(getRepoBinaryContent).toHaveBeenCalledTimes(2);
  });

  it("shows a broken-image placeholder when the image can't be fetched", async () => {
    const source = "= Doc\n\nimage::missing.png[]\n";
    const html = await renderAsciidoc(source, contextFor("/docs/main.adoc"));

    expect(html).toContain('src="data:image/svg+xml;utf8,');
    expect(html).toContain("Could%20not%20load%20image");
    expect(html).not.toContain("images/data:image");
  });

  it("fetches a repeated image only once", async () => {
    const source = "= Doc\n\nimage::diagram.svg[]\n\nimage::diagram.svg[]\n";
    await renderAsciidoc(source, contextFor("/docs/main.adoc"));

    expect(getRepoBinaryContent).toHaveBeenCalledTimes(1);
  });

  it("leaves absolute image URLs untouched", async () => {
    const source = "= Doc\n\nimage::https://example.com/pic.png[]\n";
    const html = await renderAsciidoc(source, contextFor("/docs/main.adoc"));

    expect(html).toContain('src="https://example.com/pic.png"');
  });
});
