import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@app/shared/config/api-base-url.token';
import { GroupOrdersService } from './group-orders.service';

describe('GroupOrdersService', () => {
  let service: GroupOrdersService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'https://api.example.test' },
      ],
    });

    service = TestBed.inject(GroupOrdersService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('gets the owner session id for a reservation', () => {
    service.getOwnerSession('reservation 1').subscribe((response) => {
      expect(response.guestSessionId).toBe('owner-session');
    });

    const request = httpMock.expectOne(
      'https://api.example.test/reservations/reservation%201/guest-session-id',
    );
    expect(request.request.method).toBe('GET');
    request.flush({ guestSessionId: 'owner-session' });
  });

  it('gets the participant snapshot for a group reservation', () => {
    service.getSessions('group-1').subscribe((response) => {
      expect(response.total).toBe(18);
      expect(response.participants.length).toBe(1);
    });

    const request = httpMock.expectOne(
      'https://api.example.test/guest/groups/group-1/sessions',
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      participants: [
        {
          id: 'guest-1',
          type: 'Guest',
          name: 'Guest',
          items: [],
          total: 18,
          isSubmitted: false,
        },
      ],
      total: 18,
    });
  });

  it('deletes a guest session and returns the updated participant snapshot', () => {
    service.deleteSession('group-1', 'guest-1').subscribe((response) => {
      expect(response.participants).toEqual([]);
      expect(response.total).toBe(0);
    });

    const request = httpMock.expectOne(
      'https://api.example.test/guest/groups/group-1/sessions/guest-1',
    );
    expect(request.request.method).toBe('DELETE');
    request.flush({ participants: [], total: 0 });
  });

  it('submits the consolidated pre-order for a group reservation', () => {
    const body = { reservationId: 'reservation-1' };
    service.submit('group-1', body).subscribe((response) => {
      expect(response).toEqual([{ dishId: 'dish-1', quantity: 3 }]);
    });

    const request = httpMock.expectOne(
      'https://api.example.test/group-reservations/group-1/submit',
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(body);
    request.flush([{ dishId: 'dish-1', quantity: 3 }]);
  });
});
