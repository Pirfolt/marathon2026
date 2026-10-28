import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { WaitersService } from './waiters.service';
import { API_BASE_URL } from '@app/shared/config/api-base-url.token';

describe('WaitersService', () => {
  let service: WaitersService;
  let httpTestingController: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'https://test.api' },
      ],
    });
    service = TestBed.inject(WaitersService);
    httpTestingController = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTestingController.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('returns all assigned locations from the waiter location response', () => {
    let locationIds: string[] | undefined;

    service.getWaiterLocationIds('waiter-1').subscribe((response) => {
      locationIds = response;
    });

    const request = httpTestingController.expectOne(
      'https://test.api/waiters/waiter-1/location'
    );
    expect(request.request.method).toBe('GET');
    request.flush({
      locationId: 'location-1',
      locationIds: ['location-1', 'location-2'],
    });

    expect(locationIds).toEqual(['location-1', 'location-2']);
  });

  it('supports responses from older backends with one location', () => {
    let locationIds: string[] | undefined;

    service.getWaiterLocationIds('waiter-1').subscribe((response) => {
      locationIds = response;
    });

    httpTestingController
      .expectOne('https://test.api/waiters/waiter-1/location')
      .flush({ locationId: 'location-1' });

    expect(locationIds).toEqual(['location-1']);
  });
});
