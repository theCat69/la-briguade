const CONTROL_CHARACTERS_RE = /[\x00-\x1F\x7F]/g;
const NON_PRINTABLE_ASCII_RE = /[^\x20-\x7E]/g;

export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function sanitizeControlCharacters(message: string): string {
  return message.replace(CONTROL_CHARACTERS_RE, "?");
}

export function sanitizePrintableAscii(message: string): string {
  return message.replace(NON_PRINTABLE_ASCII_RE, "?");
}

export function toSanitizedParseFailureReason(error: unknown, maxLength: number): string {
  const reason = error instanceof Error ? error.message : "unknown parse error";
  return sanitizePrintableAscii(reason).slice(0, maxLength);
}
