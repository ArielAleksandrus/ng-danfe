import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Danfe } from './danfe';

describe('Danfe', () => {
  let component: Danfe;
  let fixture: ComponentFixture<Danfe>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Danfe]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Danfe);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
