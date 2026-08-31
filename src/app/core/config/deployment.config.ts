const NOTIFICATION_HUB_PATH = '/api/v1/notifications/hub';
const ZROK_PUBLIC_ORIGIN = 'https://finance-control.shares.zrok.io';

export interface NotificationHubConfiguration {
  readonly url: string;
  /**
   * The Vercel rewrite does not support WebSocket upgrades to the public BFF.
   * Long Polling keeps SignalR's HTTP negotiation while traversing zrok safely.
   */
  readonly useLongPolling: boolean;
}

export function getNotificationHubConfiguration(
  hostname = window.location.hostname,
): NotificationHubConfiguration {
  const isVercelDeployment = hostname.toLowerCase().endsWith('.vercel.app');

  return isVercelDeployment
    ? {
        url: `${ZROK_PUBLIC_ORIGIN}${NOTIFICATION_HUB_PATH}`,
        useLongPolling: true,
      }
    : {
        url: NOTIFICATION_HUB_PATH,
        useLongPolling: false,
      };
}
