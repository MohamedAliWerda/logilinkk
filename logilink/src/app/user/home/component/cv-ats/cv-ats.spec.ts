import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CvAts } from './cv-ats';

describe('CvAts', () => {
  let component: CvAts;
  let fixture: ComponentFixture<CvAts>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CvAts]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CvAts);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
