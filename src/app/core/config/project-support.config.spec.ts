import { describe, expect, it } from 'vitest';

import { getProjectSupportConfiguration } from './project-support.config';

describe('getProjectSupportConfiguration', () => {
  it('keeps support disabled until a public profile URL is configured', () => {
    expect(getProjectSupportConfiguration()).toEqual({ url: null });
  });

  it('accepts an HTTPS support profile URL', () => {
    expect(getProjectSupportConfiguration(' https://buymeacoffee.com/financecontrol ')).toEqual({
      url: 'https://buymeacoffee.com/financecontrol',
    });
  });

  it('does not expose an unsafe, malformed, or non-official destination', () => {
    expect(getProjectSupportConfiguration('http://buymeacoffee.com/financecontrol')).toEqual({
      url: null,
    });
    expect(getProjectSupportConfiguration('not a URL')).toEqual({ url: null });
    expect(getProjectSupportConfiguration('https://buymeacoffee.com.evil.example/financecontrol')).toEqual({
      url: null,
    });
    expect(getProjectSupportConfiguration('https://example.com/financecontrol')).toEqual({ url: null });
    expect(getProjectSupportConfiguration('https://attacker@example.com/financecontrol')).toEqual({ url: null });
    expect(getProjectSupportConfiguration('https://buymeacoffee.com/')).toEqual({ url: null });
  });
});
