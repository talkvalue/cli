export function decodeJwtPayload(token: string): unknown {
  const segments = token.split(".");

  if (segments.length < 2) {
    return undefined;
  }

  try {
    const payload = Buffer.from(segments[1], "base64url").toString("utf8");
    return JSON.parse(payload);
  } catch {
    return undefined;
  }
}
