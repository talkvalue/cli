import { decodeJwtPayload } from "./jwt.js";

export interface IdTokenClaims {
  email?: string;
  org_id?: string;
  org_name?: string;
  sub?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function decodeIdToken(idToken: string): IdTokenClaims | undefined {
  const payload = decodeJwtPayload(idToken);

  if (!isRecord(payload)) {
    return undefined;
  }

  return {
    email: optionalString(payload.email),
    org_id: optionalString(payload.org_id),
    org_name: optionalString(payload.org_name),
    sub: optionalString(payload.sub),
  };
}
