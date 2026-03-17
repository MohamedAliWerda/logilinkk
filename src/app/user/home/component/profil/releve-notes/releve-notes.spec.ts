import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ReleveNotes } from './releve-notes';

describe('ReleveNotes', () => {
  let component: ReleveNotes;
  let fixture: ComponentFixture<ReleveNotes>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReleveNotes]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ReleveNotes);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
