const NOTIFICATION_HUB_PATH = '/api/v1/notifications/hub';

export interface NotificationHubConfiguration {
  readonly url: string;
  /**
   * The Vercel rewrite does not support WebSocket upgrades to the public BFF.
   * Long Polling keeps SignalR's HTTP negotiation on the same public origin.
   */
  readonly useLongPolling: boolean;
}

export function getNotificationHubConfiguration(
  hostname = window.location.hostname,
): NotificationHubConfiguration {
  const isVercelDeployment = hostname.toLowerCase().endsWith('.vercel.app');

  return {
    // Keeping the hub relative ensures Vercel forwards every SignalR request
    // through /api/*, including the zrok interstitial bypass header.
    url: NOTIFICATION_HUB_PATH,
    useLongPolling: isVercelDeployment,
  };
}
