import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Matching } from './matching';

describe('Matching', () => {
  let component: Matching;
  let fixture: ComponentFixture<Matching>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Matching]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Matching);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
