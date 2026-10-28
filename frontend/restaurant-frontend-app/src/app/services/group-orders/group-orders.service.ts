import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { API_BASE_URL } from '@app/shared/config/api-base-url.token';
import { map, Observable, switchMap } from 'rxjs';
import { SKIP_ERROR_TOAST } from '@app/auth/skip-error-toast.context';
import { GroupSessionsResponse } from '@app/models/group-orders/group-sessions-response.model';
import { GroupStatusResponse } from '@app/models/group-orders/group-status.model';
import { OwnerSessionResponse } from '@app/models/group-orders/owner-session.model';
import { GuestInvite } from '@app/models/reservations/guest-invite.model';
import { GroupInviteToken } from '@app/models/reservations/guest-invite.model';
import {
  SubmittedDish,
  SubmitGroupPreOrderRequest,
} from '@app/models/group-orders/submit-group-pre-order.model';

export interface GroupOrdersRequestOptions {
  silent?: boolean;
}

@Injectable({ providedIn: 'root' })
export class GroupOrdersService {
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly http = inject(HttpClient);

  getGroupInvite$(reservationId: string): Observable<GuestInvite> {
    return this.http
      .get<GroupInviteToken>(
        `${this.baseUrl}/reservations/${encodeURIComponent(reservationId)}/invite-token`
      )
      .pipe(
        switchMap(({ token }) =>
          this.http.get<GuestInvite>(`${this.baseUrl}/guest/invites/${encodeURIComponent(token)}`)
        )
      );
  }

  getOwnerSessionId$(reservationId: string): Observable<string> {
    return this.http
      .get<OwnerSessionResponse>(
        `${this.baseUrl}/reservations/${encodeURIComponent(reservationId)}/guest-session-id`
      )
      .pipe(map(({ guestSessionId }) => guestSessionId));
  }

  getSessions$(
    groupReservationId: string,
    options: GroupOrdersRequestOptions = {}
  ): Observable<GroupSessionsResponse> {
    return this.http.get<GroupSessionsResponse>(
      `${this.baseUrl}/guest/groups/${encodeURIComponent(groupReservationId)}/sessions`,
      { context: this.requestContext(options) }
    );
  }

  getStatus$(
    groupReservationId: string,
    options: GroupOrdersRequestOptions = {}
  ): Observable<GroupStatusResponse> {
    return this.http.get<GroupStatusResponse>(
      `${this.baseUrl}/guest/groups/${encodeURIComponent(groupReservationId)}/status`,
      { context: this.requestContext(options) }
    );
  }

  submit$(groupReservationId: string, reservationId: string): Observable<SubmittedDish[]> {
    return this.http.post<SubmittedDish[]>(
      `${this.baseUrl}/group-reservations/${encodeURIComponent(groupReservationId)}/submit`,
      { reservationId } satisfies SubmitGroupPreOrderRequest
    );
  }

  removeSession$(
    groupReservationId: string,
    guestSessionId: string
  ): Observable<GroupSessionsResponse> {
    return this.http.delete<GroupSessionsResponse>(
      `${this.baseUrl}/guest/groups/${encodeURIComponent(groupReservationId)}/sessions/${encodeURIComponent(guestSessionId)}`
    );
  }

  private requestContext(options: GroupOrdersRequestOptions): HttpContext {
    return new HttpContext().set(SKIP_ERROR_TOAST, options.silent ?? false);
  }

  // Kept as wrappers for existing application callers.
  getOwnerSession(reservationId: string): Observable<OwnerSessionResponse> {
    return this.getOwnerSessionId$(reservationId).pipe(
      map((guestSessionId) => ({ guestSessionId }))
    );
  }

  getSessions(groupReservationId: string): Observable<GroupSessionsResponse> {
    return this.getSessions$(groupReservationId);
  }

  getStatus(groupReservationId: string): Observable<GroupStatusResponse> {
    return this.getStatus$(groupReservationId);
  }

  deleteSession(
    groupReservationId: string,
    guestSessionId: string
  ): Observable<GroupSessionsResponse> {
    return this.removeSession$(groupReservationId, guestSessionId);
  }

  submit(
    groupReservationId: string,
    request: SubmitGroupPreOrderRequest
  ): Observable<SubmittedDish[]> {
    return this.submit$(groupReservationId, request.reservationId);
  }
}
