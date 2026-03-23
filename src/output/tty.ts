export function isTTY(): boolean {
  return process.stdout.isTTY === true;
}

export function detectFormat(flagValue: string | undefined): string {
  if (typeof flagValue === "string" && flagValue.length > 0) {
    return flagValue;
  }

  return isTTY() ? "table" : "json";
}
