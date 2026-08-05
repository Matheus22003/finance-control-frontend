import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { finalize, forkJoin } from 'rxjs';

import {
  FriendResponse,
  FriendshipResponse,
  GroupResponse,
  ProblemDetails,
  UserDirectoryResponse,
} from '../../core/api/api.models';
import { FinanceControlApiService } from '../../core/api/finance-control-api.service';
import { NotificationCenterService } from '../../core/notifications/notification-center.service';

@Component({
  selector: 'app-social-page',
  imports: [ReactiveFormsModule],
  templateUrl: './social.page.html',
  styleUrl: './social.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocialPage {
  private readonly api = inject(FinanceControlApiService);
  private readonly formBuilder = inject(FormBuilder);
  private readonly notificationCenter = inject(NotificationCenterService);

  protected readonly currentUser = signal<UserDirectoryResponse | null>(null);
  protected readonly friends = signal<FriendResponse[]>([]);
  protected readonly incoming = signal<FriendshipResponse[]>([]);
  protected readonly outgoing = signal<FriendshipResponse[]>([]);
  protected readonly groups = signal<GroupResponse[]>([]);
  protected readonly selectedMembers = signal<string[]>([]);
  protected readonly isLoading = signal(true);
  protected readonly isSending = signal(false);
  protected readonly isCreatingGroup = signal(false);
  protected readonly activeRequestId = signal<string | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly successMessage = signal<string | null>(null);

  protected readonly friendForm = this.formBuilder.nonNullable.group({
    email: ['', [Validators.required, Validators.email, Validators.maxLength(254)]],
  });

  protected readonly groupForm = this.formBuilder.nonNullable.group({
    name: ['', [Validators.required, Validators.pattern(/\S/), Validators.maxLength(120)]],
    description: ['', Validators.maxLength(500)],
  });

  constructor() {
    this.loadSocial();
    this.notificationCenter.changes$.pipe(takeUntilDestroyed()).subscribe((notification) => {
      if (notification.type.startsWith('FRIEND_') || notification.type.startsWith('GROUP_')) {
        this.loadSocial();
      }
    });
  }

  protected loadSocial(): void {
    this.isLoading.set(true);
    this.errorMessage.set(null);
    forkJoin({
      currentUser: this.api.getCurrentUser(),
      friends: this.api.getFriends(),
      incoming: this.api.getIncomingFriendRequests(),
      outgoing: this.api.getOutgoingFriendRequests(),
      groups: this.api.getGroups(),
    })
      .pipe(finalize(() => this.isLoading.set(false)))
      .subscribe({
        next: ({ currentUser, friends, incoming, outgoing, groups }) => {
          this.currentUser.set(currentUser);
          this.friends.set(friends);
          this.incoming.set(incoming);
          this.outgoing.set(outgoing);
          this.groups.set(groups);
        },
        error: (error: unknown) => this.errorMessage.set(this.readError(error)),
      });
  }

  protected sendFriendRequest(): void {
    this.clearMessages();
    if (this.friendForm.invalid) {
      this.friendForm.markAllAsTouched();
      return;
    }

    this.isSending.set(true);
    this.api
      .sendFriendRequest(this.friendForm.getRawValue().email.trim())
      .pipe(finalize(() => this.isSending.set(false)))
      .subscribe({
        next: () => {
          this.friendForm.reset({ email: '' });
          this.successMessage.set('Convite enviado com segurança.');
          this.loadSocial();
        },
        error: (error: unknown) => this.errorMessage.set(this.readError(error)),
      });
  }

  protected answerRequest(requestId: string, accept: boolean): void {
    this.clearMessages();
    this.activeRequestId.set(requestId);
    const operation = accept
      ? this.api.acceptFriendRequest(requestId)
      : this.api.rejectFriendRequest(requestId);
    operation.pipe(finalize(() => this.activeRequestId.set(null))).subscribe({
      next: () => {
        this.successMessage.set(accept ? 'Amizade aceita.' : 'Convite recusado.');
        this.loadSocial();
      },
      error: (error: unknown) => this.errorMessage.set(this.readError(error)),
    });
  }

  protected toggleGroupMember(userId: string, selected: boolean): void {
    this.selectedMembers.update((members) =>
      selected ? [...new Set([...members, userId])] : members.filter((id) => id !== userId),
    );
  }

  protected memberIsSelected(userId: string): boolean {
    return this.selectedMembers().includes(userId);
  }

  protected createGroup(): void {
    this.clearMessages();
    if (this.groupForm.invalid) {
      this.groupForm.markAllAsTouched();
      return;
    }

    const value = this.groupForm.getRawValue();
    this.isCreatingGroup.set(true);
    this.api
      .createGroup({
        name: value.name.trim(),
        description: value.description.trim() || null,
        memberUserIds: this.selectedMembers(),
      })
      .pipe(finalize(() => this.isCreatingGroup.set(false)))
      .subscribe({
        next: () => {
          this.groupForm.reset({ name: '', description: '' });
          this.selectedMembers.set([]);
          this.successMessage.set('Grupo criado. Os membros já estão disponíveis nas dívidas.');
          this.loadSocial();
        },
        error: (error: unknown) => this.errorMessage.set(this.readError(error)),
      });
  }

  protected removeFriend(friend: FriendResponse): void {
    this.clearMessages();
    this.api.removeFriend(friend.userId).subscribe({
      next: () => {
        this.successMessage.set('Amizade removida. Dívidas existentes foram preservadas.');
        this.loadSocial();
      },
      error: (error: unknown) => this.errorMessage.set(this.readError(error)),
    });
  }

  protected deleteGroup(group: GroupResponse): void {
    this.clearMessages();
    this.api.deleteGroup(group.id).subscribe({
      next: () => {
        this.successMessage.set('Grupo removido.');
        this.loadSocial();
      },
      error: (error: unknown) => this.errorMessage.set(this.readError(error)),
    });
  }

  protected isGroupOwner(group: GroupResponse): boolean {
    return group.createdByUserId === this.currentUser()?.id;
  }

  private clearMessages(): void {
    this.errorMessage.set(null);
    this.successMessage.set(null);
  }

  private readError(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const problem = error.error as Partial<ProblemDetails> | null;
      if (problem?.detail) {
        return problem.detail;
      }
      if (error.status === 404) {
        return 'Nenhum outro usuário foi encontrado com esse e-mail.';
      }
      if (error.status === 409) {
        return 'Esse convite ou relacionamento já existe.';
      }
    }
    return 'Não foi possível concluir a operação agora. Tente novamente.';
  }
}
