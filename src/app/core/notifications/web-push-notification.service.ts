import { Injectable, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SwPush } from '@angular/service-worker';
import { finalize, forkJoin, take } from 'rxjs';

import { FinanceControlApiService } from '../api/finance-control-api.service';
import { PushNotificationConfigurationResponse, PushSubscriptionResponse } from '../api/api.models';
import { AuthService } from '../auth/auth.service';

@Injectable({ providedIn: 'root' })
export class WebPushNotificationService {
  private readonly api = inject(FinanceControlApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly swPush = inject(SwPush);
  private readonly configuredState = signal(false);
  private readonly subscribedState = signal(false);
  private readonly devicesState = signal<PushSubscriptionResponse[]>([]);
  private readonly busyState = signal(false);
  private readonly messageState = signal<string | null>(null);
  private initialized = false;
  private publicKey: string | null = null;

  readonly supported = this.swPush.isEnabled;
  readonly configured = this.configuredState.asReadonly();
  readonly subscribed = this.subscribedState.asReadonly();
  readonly devices = this.devicesState.asReadonly();
  readonly busy = this.busyState.asReadonly();
  readonly message = this.messageState.asReadonly();

  initialize(): void {
    if (this.initialized) return;
    this.initialized = true;
    this.swPush.notificationClicks.subscribe((event) => {
      const route = event.notification.data?.['route'];
      if (typeof route === 'string' && route.startsWith('/')) {
        void this.router.navigateByUrl(route);
      }
    });
    this.swPush.pushSubscriptionChanges.subscribe(({ oldSubscription, newSubscription }) => {
      if (!this.auth.isAuthenticated()) return;
      if (newSubscription) {
        if (oldSubscription && oldSubscription.endpoint !== newSubscription.endpoint) {
          const persistReplacement = () => this.persistBrowserSubscription(newSubscription, false);
          this.api.unsubscribeCurrentPushEndpoint(oldSubscription.endpoint).subscribe({
            next: persistReplacement,
            error: persistReplacement,
          });
        } else {
          this.persistBrowserSubscription(newSubscription, false);
        }
        return;
      }
      if (oldSubscription) {
        this.api.unsubscribeCurrentPushEndpoint(oldSubscription.endpoint).subscribe({
          next: () => this.subscribedState.set(false),
          error: () =>
            this.messageState.set('A inscrição push expirou e não pôde ser removida do servidor.'),
        });
      }
    });
  }

  refresh(): void {
    if (!this.auth.isAuthenticated()) return;
    this.messageState.set(null);
    forkJoin({
      configuration: this.api.getPushNotificationConfiguration(),
      devices: this.api.getPushSubscriptions(),
    }).subscribe({
      next: ({ configuration, devices }) => {
        this.applyConfiguration(configuration);
        this.devicesState.set(devices);
        this.swPush.subscription.pipe(take(1)).subscribe((subscription) => {
          this.subscribedState.set(subscription !== null);
        });
      },
      error: () => this.messageState.set('Não foi possível carregar os dispositivos push.'),
    });
  }

  enableCurrentDevice(): void {
    this.messageState.set(null);
    if (!this.supported) {
      this.messageState.set('Push requer HTTPS e um navegador compatível com service workers.');
      return;
    }
    if (!this.publicKey) {
      this.messageState.set('O servidor ainda não possui as chaves de push configuradas.');
      return;
    }

    this.busyState.set(true);
    void this.swPush
      .requestSubscription({ serverPublicKey: this.publicKey })
      .then((subscription) => {
        this.persistBrowserSubscription(subscription, true);
      })
      .catch(() => {
        this.busyState.set(false);
        this.messageState.set('A permissão de notificações não foi concedida.');
      });
  }

  disableCurrentDevice(): void {
    this.messageState.set(null);
    this.busyState.set(true);
    this.swPush.subscription.pipe(take(1)).subscribe((subscription) => {
      if (!subscription) {
        this.busyState.set(false);
        this.subscribedState.set(false);
        return;
      }

      this.api
        .unsubscribeCurrentPushEndpoint(subscription.endpoint)
        .pipe(finalize(() => this.busyState.set(false)))
        .subscribe({
          next: () => {
            void subscription.unsubscribe();
            this.subscribedState.set(false);
            this.refresh();
            this.messageState.set('Push desativado neste dispositivo.');
          },
          error: () => this.messageState.set('Não foi possível desativar este dispositivo.'),
        });
    });
  }

  removeDevice(device: PushSubscriptionResponse): void {
    this.messageState.set(null);
    this.busyState.set(true);
    this.api
      .removePushSubscription(device.id)
      .pipe(finalize(() => this.busyState.set(false)))
      .subscribe({
        next: () => {
          this.devicesState.update((current) =>
            current.filter((candidate) => candidate.id !== device.id),
          );
          this.messageState.set('Dispositivo removido.');
        },
        error: () => this.messageState.set('Não foi possível remover o dispositivo.'),
      });
  }

  private applyConfiguration(configuration: PushNotificationConfigurationResponse): void {
    this.configuredState.set(configuration.isConfigured);
    this.publicKey = configuration.publicKey;
  }

  private persistBrowserSubscription(subscription: PushSubscription, announce: boolean): void {
    const json = subscription.toJSON();
    const p256Dh = json.keys?.['p256dh'];
    const auth = json.keys?.['auth'];
    if (!json.endpoint || !p256Dh || !auth) {
      if (announce) this.busyState.set(false);
      this.messageState.set('O navegador não retornou uma inscrição push válida.');
      return;
    }

    const request = this.api.createPushSubscription({
      endpoint: json.endpoint,
      p256Dh,
      auth,
      deviceName: this.deviceName(),
    });
    const trackedRequest = announce
      ? request.pipe(finalize(() => this.busyState.set(false)))
      : request;
    trackedRequest.subscribe({
      next: (device) => {
        this.subscribedState.set(true);
        this.devicesState.update((current) => [
          device,
          ...current.filter((candidate) => candidate.id !== device.id),
        ]);
        if (announce) this.messageState.set('Push ativado neste dispositivo.');
      },
      error: () => this.messageState.set('Não foi possível registrar este dispositivo.'),
    });
  }

  private deviceName(): string {
    const platform = navigator.platform?.trim();
    const userAgent = navigator.userAgent.replace(/\s+/g, ' ').trim();
    return [platform, userAgent].filter(Boolean).join(' · ').slice(0, 200) || 'Navegador web';
  }
}
