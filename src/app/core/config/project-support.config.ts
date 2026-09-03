export interface ProjectSupportConfiguration {
  readonly url: string | null;
}

// This is deliberately public: a Buy Me a Coffee profile is a destination
// link, not an application credential. Keep it null until the project owner
// supplies the real profile URL.
const PROJECT_SUPPORT_URL: string | null = null;

export function getProjectSupportConfiguration(
  configuredUrl = PROJECT_SUPPORT_URL,
): ProjectSupportConfiguration {
  const candidate = configuredUrl?.trim();

  if (!candidate) {
    return { url: null };
  }

  try {
    const parsed = new URL(candidate);
    return parsed.protocol === 'https:' ? { url: parsed.toString() } : { url: null };
  } catch {
    return { url: null };
  }
}
