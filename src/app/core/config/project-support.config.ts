export interface ProjectSupportConfiguration {
  readonly url: string | null;
}

// This is deliberately public: a Buy Me a Coffee profile is a destination
// link, not an application credential. Keep it null until the project owner
// supplies the real profile URL.
const PROJECT_SUPPORT_URL: string | null = null;
const OFFICIAL_SUPPORT_HOSTS = new Set(['buymeacoffee.com', 'www.buymeacoffee.com']);

export function getProjectSupportConfiguration(
  configuredUrl = PROJECT_SUPPORT_URL,
): ProjectSupportConfiguration {
  const candidate = configuredUrl?.trim();

  if (!candidate) {
    return { url: null };
  }

  try {
    const parsed = new URL(candidate);
    const isOfficialProfile =
      parsed.protocol === 'https:' &&
      !parsed.username &&
      !parsed.password &&
      OFFICIAL_SUPPORT_HOSTS.has(parsed.hostname) &&
      parsed.pathname !== '/';

    return isOfficialProfile ? { url: parsed.toString() } : { url: null };
  } catch {
    return { url: null };
  }
}
