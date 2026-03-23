export interface EnvConfig {
  token: string | undefined;
  apiUrl: string | undefined;
  authApiUrl: string | undefined;
  profile: string | undefined;
  noColor: boolean;
  forceColor: boolean;
}

export function resolveEnv(): EnvConfig {
  return {
    token: process.env.TALKVALUE_TOKEN,
    apiUrl: process.env.TALKVALUE_API_URL,
    authApiUrl: process.env.TALKVALUE_AUTH_API_URL,
    profile: process.env.TALKVALUE_PROFILE,
    noColor: process.env.NO_COLOR !== undefined,
    forceColor: process.env.FORCE_COLOR !== undefined,
  };
}
