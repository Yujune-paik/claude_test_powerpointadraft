import JSZip from "jszip";

/**
 * Parse a PPTX file client-side and return the slide count.
 */
export async function parseSlideCount(file: File): Promise<number> {
  const zip = await JSZip.loadAsync(file);
  // Count files matching ppt/slides/slideN.xml (not _rels)
  let count = 0;
  zip.forEach((path) => {
    if (/^ppt\/slides\/slide\d+\.xml$/.test(path)) {
      count++;
    }
  });
  return count;
}

/**
 * Export a PPTX file with speaker notes embedded, entirely client-side.
 */
export async function exportWithNotes(
  file: File,
  notes: Record<number, string>
): Promise<Blob> {
  const zip = await JSZip.loadAsync(file);

  for (const [indexStr, noteText] of Object.entries(notes)) {
    const slideNum = parseInt(indexStr) + 1; // 0-indexed to 1-indexed
    const slidePath = `ppt/slides/slide${slideNum}.xml`;
    const slideRelsPath = `ppt/slides/_rels/slide${slideNum}.xml.rels`;
    const notesPath = `ppt/notesSlides/notesSlide${slideNum}.xml`;
    const notesRelsPath = `ppt/notesSlides/_rels/notesSlide${slideNum}.xml.rels`;

    if (!zip.file(slidePath)) continue;

    // Check if notes slide already exists
    const existingNotes = zip.file(notesPath);
    if (existingNotes) {
      // Update existing notes slide
      const xml = await existingNotes.async("string");
      const updated = updateNotesText(xml, noteText);
      zip.file(notesPath, updated);
    } else {
      // Create new notes slide
      await addNotesRelationship(zip, slideRelsPath, slideNum);
      zip.file(notesPath, createNotesSlideXml(noteText, slideNum));
      zip.file(notesRelsPath, createNotesSlideRels(slideNum));
      addContentType(zip, slideNum);
    }
  }

  return zip.generateAsync({ type: "blob" });
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Update the text content in an existing notes slide XML.
 */
function updateNotesText(xml: string, noteText: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xml, "application/xml");
  const ns = "http://schemas.openxmlformats.org/drawingml/2006/main";
  const pNs =
    "http://schemas.openxmlformats.org/presentationml/2006/main";

  // Find the notes text body (ph type="body" idx="1")
  const spList = doc.getElementsByTagNameNS(pNs, "sp");
  for (let i = 0; i < spList.length; i++) {
    const sp = spList[i];
    const phElements = sp.getElementsByTagNameNS(pNs, "ph");
    for (let j = 0; j < phElements.length; j++) {
      const ph = phElements[j];
      if (ph.getAttribute("type") === "body") {
        const txBody = sp.getElementsByTagNameNS(pNs, "txBody")[0] ||
          sp.getElementsByTagNameNS(ns, "txBody")[0];
        if (!txBody) continue;

        // Clear existing paragraphs
        const existingPs = txBody.getElementsByTagNameNS(ns, "p");
        while (existingPs.length > 0) {
          txBody.removeChild(existingPs[0]);
        }

        // Add new paragraphs from note text
        const lines = noteText.split("\n");
        for (const line of lines) {
          const p = doc.createElementNS(ns, "a:p");
          const r = doc.createElementNS(ns, "a:r");
          const t = doc.createElementNS(ns, "a:t");
          t.textContent = line;
          r.appendChild(t);
          p.appendChild(r);
          txBody.appendChild(p);
        }

        const serializer = new XMLSerializer();
        return serializer.serializeToString(doc);
      }
    }
  }

  // Fallback: if we can't find the body placeholder, return with simple replacement
  return xml;
}

/**
 * Create a new notes slide XML.
 */
function createNotesSlideXml(noteText: string, _slideNum: number): string {
  const paragraphs = noteText
    .split("\n")
    .map(
      (line) =>
        `<a:p><a:r><a:rPr lang="ja-JP" dirty="0"/><a:t>${escapeXml(line)}</a:t></a:r></a:p>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:notes xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
         xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
         xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr>
        <p:cNvPr id="1" name=""/>
        <p:cNvGrpSpPr/>
        <p:nvPr/>
      </p:nvGrpSpPr>
      <p:grpSpPr/>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="2" name="Slide Image Placeholder 1"/>
          <p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="sldImg"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
      </p:sp>
      <p:sp>
        <p:nvSpPr>
          <p:cNvPr id="3" name="Notes Placeholder 2"/>
          <p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr>
          <p:nvPr><p:ph type="body" idx="1"/></p:nvPr>
        </p:nvSpPr>
        <p:spPr/>
        <p:txBody>
          <a:bodyPr/>
          <a:lstStyle/>
          ${paragraphs}
        </p:txBody>
      </p:sp>
    </p:spTree>
  </p:cSld>
</p:notes>`;
}

/**
 * Create the .rels file for a notes slide.
 */
function createNotesSlideRels(slideNum: number): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="../slides/slide${slideNum}.xml"/>
</Relationships>`;
}

/**
 * Add a relationship from the slide to the notes slide.
 */
async function addNotesRelationship(
  zip: JSZip,
  slideRelsPath: string,
  slideNum: number
): Promise<string> {
  let relsXml: string;
  const existing = zip.file(slideRelsPath);

  if (existing) {
    relsXml = await existing.async("string");
  } else {
    relsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
</Relationships>`;
  }

  // Check if notes relationship already exists
  if (relsXml.includes("relationships/notesSlide")) {
    return "rIdNotes";
  }

  // Find a unique rId
  const rIdMatch = relsXml.match(/rId(\d+)/g) || [];
  const maxId = rIdMatch.reduce((max, id) => {
    const num = parseInt(id.replace("rId", ""));
    return num > max ? num : max;
  }, 0);
  const newRId = `rId${maxId + 1}`;

  const newRel = `<Relationship Id="${newRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/notesSlide" Target="../notesSlides/notesSlide${slideNum}.xml"/>`;

  relsXml = relsXml.replace("</Relationships>", `  ${newRel}\n</Relationships>`);
  zip.file(slideRelsPath, relsXml);
  return newRId;
}

/**
 * Add content type for the notes slide if not already present.
 */
async function addContentType(zip: JSZip, slideNum: number): Promise<void> {
  const ctFile = zip.file("[Content_Types].xml");
  if (!ctFile) return;

  let ctXml = await ctFile.async("string");
  const notesPartName = `/ppt/notesSlides/notesSlide${slideNum}.xml`;

  if (ctXml.includes(notesPartName)) return;

  // Check if there's already an extension-based default for notesSlides
  if (
    !ctXml.includes("notesSlide") &&
    !ctXml.includes("application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml")
  ) {
    // Add as Override
    const override = `<Override PartName="${notesPartName}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`;
    ctXml = ctXml.replace("</Types>", `  ${override}\n</Types>`);
    zip.file("[Content_Types].xml", ctXml);
  } else if (!ctXml.includes(notesPartName)) {
    // There are other notesSlide entries but not this one
    const override = `<Override PartName="${notesPartName}" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>`;
    ctXml = ctXml.replace("</Types>", `  ${override}\n</Types>`);
    zip.file("[Content_Types].xml", ctXml);
  }
}
