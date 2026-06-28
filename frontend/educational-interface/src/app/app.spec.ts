import { TestBed } from '@angular/core/testing';
import { AppComponent } from './app';

describe('AppComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [AppComponent],
    }).compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app).toBeTruthy();
  });

  it('should start with isUserAuthenticated as false', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    expect(app.isUserAuthenticated).toBe(false);
  });

  it('should set isUserAuthenticated to true on unlockSessionAccess', () => {
    const fixture = TestBed.createComponent(AppComponent);
    const app = fixture.componentInstance;
    app.unlockSessionAccess('narendra');
    expect(app.isUserAuthenticated).toBe(true);
    expect(app.sessionUsername).toBe('narendra');
  });
});
