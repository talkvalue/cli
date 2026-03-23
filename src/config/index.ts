export {
  createProfile,
  deleteProfile,
  getActiveProfile,
  getProfile,
  listProfiles,
  loadConfig,
  saveConfig,
  setActiveProfile,
  setProfile,
} from "./config.js";
export type { Config, Profile } from "./config.js";
export { ensureConfigDir, getConfigDir, getConfigFilePath } from "./paths.js";
