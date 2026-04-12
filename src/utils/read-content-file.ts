import { readFileSync } from "node:fs";

export function readContentFile(
  filePath: string,
  maxBytes: number,
  contentType = "content",
): string {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch {
    throw new Error(`Could not read ${contentType} file: ${filePath}`);
  }

  if (raw.length > maxBytes) {
    const normalizedType = contentType.charAt(0).toUpperCase() + contentType.slice(1);
    throw new Error(`${normalizedType} file exceeds size limit, skipping: ${filePath}`);
  }

  return raw;
}
