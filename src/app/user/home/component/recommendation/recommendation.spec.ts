import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Recommendation } from './recommendation';

describe('Recommendation', () => {
  let component: Recommendation;
  let fixture: ComponentFixture<Recommendation>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Recommendation]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Recommendation);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
