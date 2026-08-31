import { describe, expect, it } from 'vitest';

import { getNotificationHubConfiguration } from './deployment.config';

describe('getNotificationHubConfiguration', () => {
  it('keeps the SignalR hub on the same origin outside Vercel', () => {
    expect(getNotificationHubConfiguration('localhost')).toEqual({
      url: '/api/v1/notifications/hub',
      useLongPolling: false,
    });
  });

  it('uses the zrok hub with Long Polling on Vercel', () => {
    expect(getNotificationHubConfiguration('finance-control-frontend-gamma.vercel.app')).toEqual({
      url: 'https://finance-control.shares.zrok.io/api/v1/notifications/hub',
      useLongPolling: true,
    });
  });
});
