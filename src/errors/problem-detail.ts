import { AuthError, CliError, ForbiddenError, NotFoundError } from "./cli-error.js";

const AUTH_ERROR_CODE_MAX = 1500;
const AUTH_ERROR_CODE_MIN = 1100;
export interface ProblemDetail {
  type: string;
  title: string;
  status: number;
  detail: string;
  errorCode?: number;
  messageKey?: string;
}

const isObjectRecord = (value: unknown): value is Record<string, unknown> => {
  return typeof value === "object" && value !== null;
};

const isInRange = (value: number, min: number, max: number): boolean => {
  return value >= min && value <= max;
};

export const isProblemDetail = (body: unknown): body is ProblemDetail => {
  if (!isObjectRecord(body)) {
    return false;
  }

  if (typeof body.type !== "string") {
    return false;
  }

  if (typeof body.title !== "string") {
    return false;
  }

  if (typeof body.status !== "number") {
    return false;
  }

  if (typeof body.detail !== "string") {
    return false;
  }

  if ("errorCode" in body && typeof body.errorCode !== "number") {
    return false;
  }

  if ("messageKey" in body && typeof body.messageKey !== "string") {
    return false;
  }

  return true;
};

export const parseProblemDetail = (body: unknown): CliError => {
  if (!isProblemDetail(body)) {
    return new CliError("Unexpected error response");
  }

  const message = body.detail;

  if (
    typeof body.errorCode === "number" &&
    isInRange(body.errorCode, AUTH_ERROR_CODE_MIN, AUTH_ERROR_CODE_MAX)
  ) {
    return new AuthError(message);
  }

  if (body.status === 401) {
    return new AuthError(message);
  }

  if (body.status === 403) {
    return new ForbiddenError(message);
  }

  if (body.status === 404) {
    return new NotFoundError(message);
  }

  return new CliError(message);
};
