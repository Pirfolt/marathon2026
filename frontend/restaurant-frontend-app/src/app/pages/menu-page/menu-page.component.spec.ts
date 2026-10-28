import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MenuPageComponent } from './menu-page.component';
import { API_BASE_URL } from '@app/shared/config/api-base-url.token';
import { DishesService } from '@app/services/dishes/dishes.service';
import { DishListResponse } from '@app/models/dishes/dish-list-response.model';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

describe('MenuPageComponent', () => {
  let component: MenuPageComponent;
  let fixture: ComponentFixture<MenuPageComponent>;
  let dishesService: jasmine.SpyObj<DishesService>;

  beforeEach(async () => {
    dishesService = jasmine.createSpyObj<DishesService>('DishesService', ['getDishes']);
    dishesService.getDishes.and.returnValue(of([]));

    await TestBed.configureTestingModule({
      providers: [
        { provide: API_BASE_URL, useValue: 'https://test.api' },
        provideHttpClient(),
        provideRouter([]),
      ],
      imports: [MenuPageComponent],
    })
      .overrideComponent(MenuPageComponent, {
        set: {
          providers: [{ provide: DishesService, useValue: dishesService }],
        },
      })
      .compileComponents();

    fixture = TestBed.createComponent(MenuPageComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should display only one dish for duplicate names across locations', () => {
    const duplicateDish = createDish('location-one-dish', 'Spring Garden Salad');
    const sameDishFromAnotherLocation = createDish(
      'location-two-dish',
      ' spring   garden salad ',
    );
    const differentCategory = createDish(
      'main-course-dish',
      'Spring Garden Salad',
      'MainCourse',
    );

    dishesService.getDishes.and.returnValue(
      of([duplicateDish, sameDishFromAnotherLocation, differentCategory]),
    );

    component.loadDishes();

    expect(component.dishes.map((dish) => dish.id)).toEqual([
      'location-one-dish',
      'main-course-dish',
    ]);
  });

  function createDish(
    id: string,
    name: string,
    dishType = 'Appetizer',
  ): DishListResponse {
    return {
      id,
      name,
      imageUrl: 'assets/img/dish.png',
      price: 12,
      state: 'Available',
      weight: '250 g',
      dishType,
      description: 'Sample description',
      calories: '100',
      proteins: '5',
      carbohydrates: '10',
      fats: '3',
      vitamins: 'A',
    };
  }
});
