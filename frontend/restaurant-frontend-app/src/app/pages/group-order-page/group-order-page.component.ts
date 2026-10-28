import { CurrencyPipe, DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import {
  EMPTY,
  Subscription,
  catchError,
  defer,
  exhaustMap,
  finalize,
  forkJoin,
  interval,
  of,
  switchMap,
  tap,
} from 'rxjs';
import { Participant } from '@app/models/group-orders/participant.model';
import { GroupSessionsResponse } from '@app/models/group-orders/group-sessions-response.model';
import { GroupStatusResponse } from '@app/models/group-orders/group-status.model';
import { GuestInvite } from '@app/models/reservations/guest-invite.model';
import { GroupOrdersService } from '@app/services/group-orders/group-orders.service';
import { ToastService } from '@app/services/toast/toast.service';
import { ModalComponent } from '@app/shared/custom-components/modal/modal.component';
import { ParticipantCardComponent } from '@app/components/group-orders/participant-card/participant-card.component';
import { consolidatePreOrder } from '@app/shared/helpers/consolidate-pre-order';
import { getServerErrorMessage } from '@app/shared/helpers/http-error-helpers';

const REFRESH_INTERVAL_MS = 15_000;

@Component({
  selector: 'app-group-order-page',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, RouterLink, ModalComponent, ParticipantCardComponent],
  templateUrl: './group-order-page.component.html',
  styleUrl: './group-order-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GroupOrderPageComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly groupOrdersService = inject(GroupOrdersService);
  private readonly toastService = inject(ToastService);
  private readonly destroyRef = inject(DestroyRef);
  private syncSubscription: Subscription | null = null;

  readonly reservationId = signal('');
  readonly groupReservationId = signal('');
  readonly invite = signal<GuestInvite | null>(null);
  readonly ownerSessionId = signal('');
  readonly sessions = signal<GroupSessionsResponse | null>(null);
  readonly groupStatus = signal<GroupStatusResponse | null>(null);
  readonly loading = signal(true);
  readonly loadError = signal('');
  readonly deletingSessionId = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly refreshing = signal(false);
  readonly refreshError = signal(false);
  readonly updatedAt = signal<Date | null>(null);
  readonly showSubmitConfirmation = signal(false);
  readonly guestToRemove = signal<Participant | null>(null);

  readonly participants = computed(() => this.sessions()?.participants ?? []);
  readonly consolidatedOrder = computed(() => consolidatePreOrder(this.participants()));
  readonly submittedParticipantCount = computed(
    () => this.participants().filter((participant) => participant.isSubmitted).length
  );
  readonly unsubmittedParticipantCount = computed(
    () => this.participants().filter((participant) => !participant.isSubmitted).length
  );
  readonly hasAnyDishes = computed(() =>
    this.participants().some((participant) => participant.items.length > 0)
  );
  readonly canSubmit = computed(
    () =>
      this.groupStatus()?.status === 'Open' &&
      this.consolidatedOrder().items.length > 0 &&
      !this.submitting()
  );
  readonly statusLabel = computed(() => {
    switch (this.groupStatus()?.status) {
      case 'Open':
        return 'Collecting pre-orders';
      case 'Submitted':
        return 'Sent to Restaurant';
      case 'Closed':
        return 'Closed';
      default:
        return 'Unknown';
    }
  });

  ngOnInit(): void {
    const reservationId = this.route.snapshot.paramMap.get('reservationId');
    if (!reservationId) {
      this.loading.set(false);
      this.loadError.set('Group reservation not found');
      return;
    }

    this.reservationId.set(reservationId);
    this.loadGroupOrder();
  }

  loadGroupOrder(): void {
    this.stopSynchronization();
    this.loading.set(true);
    this.loadError.set('');

    this.groupOrdersService
      .getGroupInvite$(this.reservationId())
      .pipe(
        switchMap((invite) =>
          this.groupOrdersService.getOwnerSessionId$(this.reservationId()).pipe(
            switchMap((ownerSessionId) =>
              forkJoin({
                invite: of(invite),
                ownerSessionId: of(ownerSessionId),
                sessions: this.groupOrdersService.getSessions$(invite.GroupReservationId),
                status: this.groupOrdersService.getStatus$(invite.GroupReservationId),
              })
            )
          )
        ),
        finalize(() => this.loading.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: ({ invite, ownerSessionId, sessions, status }) => {
          this.invite.set(invite);
          this.groupReservationId.set(invite.GroupReservationId);
          this.ownerSessionId.set(ownerSessionId);
          this.sessions.set(sessions);
          this.groupStatus.set(status);
          this.updatedAt.set(new Date());
          this.refreshError.set(false);
          if (status.status === 'Open') {
            this.startSynchronization();
          }
        },
        error: (error: unknown) => {
          this.loadError.set(this.getErrorMessage(error));
        },
      });
  }

  refresh(): void {
    this.refreshSnapshot$().pipe(takeUntilDestroyed(this.destroyRef)).subscribe();
  }

  openSubmitConfirmation(): void {
    if (this.canSubmit()) {
      this.showSubmitConfirmation.set(true);
    }
  }

  closeSubmitConfirmation(): void {
    if (!this.submitting()) {
      this.showSubmitConfirmation.set(false);
    }
  }

  confirmSubmit(): void {
    const groupReservationId = this.groupReservationId();
    const reservationId = this.reservationId();
    if (!groupReservationId || !reservationId || !this.canSubmit()) {
      return;
    }

    this.submitting.set(true);
    this.groupOrdersService
      .submit$(groupReservationId, reservationId)
      .pipe(
        finalize(() => this.submitting.set(false)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: () => {
          this.showSubmitConfirmation.set(false);
          this.groupStatus.update((status) =>
            status ? { ...status, status: 'Submitted' } : status
          );
          this.stopSynchronization();
          this.toastService.success('Pre-order sent to the restaurant');
        },
        error: () => {
          // tokenInterceptor displays the API error toast; leave the confirmation available for retry.
        },
      });
  }

  requestRemoveGuest(participant: Participant): void {
    if (participant.type === 'Guest' && this.groupStatus()?.status === 'Open') {
      this.guestToRemove.set(participant);
    }
  }

  closeRemoveGuestConfirmation(): void {
    if (!this.deletingSessionId()) {
      this.guestToRemove.set(null);
    }
  }

  confirmRemoveGuest(): void {
    const participant = this.guestToRemove();
    const groupReservationId = this.groupReservationId();
    if (
      !participant ||
      participant.type !== 'Guest' ||
      !groupReservationId ||
      this.deletingSessionId()
    ) {
      return;
    }

    this.deletingSessionId.set(participant.id);
    this.groupOrdersService
      .removeSession$(groupReservationId, participant.id)
      .pipe(
        finalize(() => this.deletingSessionId.set(null)),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe({
        next: (sessions) => {
          this.sessions.set(sessions);
          this.updatedAt.set(new Date());
          this.refreshError.set(false);
          this.guestToRemove.set(null);
        },
        error: () => {
          this.guestToRemove.set(null);
        },
      });
  }

  private startSynchronization(): void {
    if (this.syncSubscription || this.groupStatus()?.status !== 'Open') {
      return;
    }

    this.syncSubscription = interval(REFRESH_INTERVAL_MS)
      .pipe(
        exhaustMap(() => this.refreshSnapshot$()),
        takeUntilDestroyed(this.destroyRef)
      )
      .subscribe();
  }

  private stopSynchronization(): void {
    this.syncSubscription?.unsubscribe();
    this.syncSubscription = null;
  }

  private refreshSnapshot$() {
    const groupReservationId = this.groupReservationId();
    if (!groupReservationId || this.refreshing() || this.groupStatus()?.status !== 'Open') {
      return EMPTY;
    }

    return defer(() => {
      this.refreshing.set(true);
      return forkJoin({
        sessions: this.groupOrdersService.getSessions$(groupReservationId, { silent: true }),
        status: this.groupOrdersService.getStatus$(groupReservationId, { silent: true }),
      }).pipe(
        tap(({ sessions, status }) => {
          this.sessions.set(sessions);
          this.groupStatus.set(status);
          this.updatedAt.set(new Date());
          this.refreshError.set(false);
          if (status.status !== 'Open') {
            this.stopSynchronization();
          }
        }),
        catchError(() => {
          this.refreshError.set(true);
          return EMPTY;
        }),
        finalize(() => this.refreshing.set(false))
      );
    });
  }

  private getErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 404) {
      return 'Group reservation not found';
    }
    if (error instanceof HttpErrorResponse) {
      return getServerErrorMessage(error) || 'Could not load this group order.';
    }
    return 'Could not load this group order.';
  }
}
