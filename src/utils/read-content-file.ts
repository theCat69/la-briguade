import { readFileSync } from "node:fs";

export function readContentFile(
  filePath: string,
  maxLength: number,
  contentType = "content",
): string {
  let raw: string;
  try {
    raw = readFileSync(filePath, "utf-8");
  } catch (error) {
    throw new Error(`Could not read ${contentType} file: ${filePath}`, { cause: error });
  }

  if (raw.length > maxLength) {
    throw new Error(`${contentType} file exceeds size limit: ${filePath}`);
  }

  return raw;
}
