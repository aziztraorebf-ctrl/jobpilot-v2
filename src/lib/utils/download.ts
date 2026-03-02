function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadAsTxt(text: string, filename: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  triggerDownload(blob, filename.endsWith(".txt") ? filename : `${filename}.txt`);
}

export async function downloadAsDocx(
  text: string,
  filename: string
): Promise<void> {
  const { Document, Packer, Paragraph, TextRun } = await import("docx");

  const paragraphs = text.split("\n").map(
    (line) =>
      new Paragraph({
        children: [new TextRun(line)],
      })
  );

  const doc = new Document({
    sections: [{ children: paragraphs }],
  });

  const blob = await Packer.toBlob(doc);
  triggerDownload(
    blob,
    filename.endsWith(".docx") ? filename : `${filename}.docx`
  );
}
