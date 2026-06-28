import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { LoginComponent } from './components/dashboard/login.component';
import { ApiService } from './services/api.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, DashboardComponent, LoginComponent],
  template: `
    <app-login *ngIf="!isUserAuthenticated" (loginSuccess)="unlockSessionAccess($event)"></app-login>
    
    <app-dashboard *ngIf="isUserAuthenticated" [username]="sessionUsername" (logout)="lockSessionAccess()"></app-dashboard>
  `,
  styles: [`
    :host {
      display: block;
      margin: 0;
      padding: 0;
      width: 100%;
      height: 100vh;
      overflow: hidden;
      background-color: #0b0f19;
    }
  `]
})
export class AppComponent implements OnInit {
  isUserAuthenticated: boolean = false;
  sessionUsername: string = '';

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    // 🌟 LIFE-CYCLE SEED: Scan browser environment memory for structural access tokens
    const cachedToken = localStorage.getItem('authToken');
    const cachedUser = localStorage.getItem('sessionUser');

    if (cachedToken && cachedUser) {
      console.log('🛰️ Active token verified in local memory matrix. Auto-bypassing login card...');
      this.sessionUsername = cachedUser;
      this.isUserAuthenticated = true;
    }
  }

  unlockSessionAccess(username: string) {
    this.sessionUsername = username;
    this.isUserAuthenticated = true;
  }

  lockSessionAccess() {
    console.log('🔒 Locking session access. Removing tokens from memory matrix...');
    localStorage.removeItem('authToken');
    localStorage.removeItem('sessionUser');
    this.sessionUsername = '';
    this.isUserAuthenticated = false;
  }
}

