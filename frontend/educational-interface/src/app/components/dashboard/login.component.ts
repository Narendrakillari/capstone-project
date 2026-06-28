import { Component, Output, EventEmitter, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../services/api.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.css']
})
export class LoginComponent {
  // Input Binding State Variables (Login)
  username: string = '';
  password: string = '';
  
  // Sign Up State Variables
  isSignUpActive: boolean = false;
  signUpUsername: string = '';
  signUpEmail: string = '';
  signUpPass: string = '';
  signUpConfirmPass: string = '';

  errorMessage: string | null = null;
  successMessage: string | null = null;

  // Session token event emmiter out to main app layer shell
  @Output() loginSuccess = new EventEmitter<string>();

  constructor(private apiService: ApiService, private cdr: ChangeDetectorRef) {}

  toggleTab(mode: 'login' | 'signup') {
    this.isSignUpActive = mode === 'signup';
    this.errorMessage = null;
    this.successMessage = null;
    this.cdr.detectChanges();
  }

  handleAuthSubmission() {
    this.errorMessage = null;

    if (!this.username.trim() || !this.password.trim()) {
      this.errorMessage = 'Please populate both configuration fields identity tracks.';
      return;
    }

    // 🚀 EXECUTE LIVE BACKEND SIGNATURE VALIDATION PASS
    this.apiService.login(this.username, this.password).subscribe({
      next: (response) => {
        console.log('🔒 Access key verified. Storing encrypted session context...');
        
        // Save token parameters locally inside your browser cache storage parameters
        localStorage.setItem('authToken', response.access_token);
        localStorage.setItem('sessionUser', response.username);
        
        // Dispatch completion notification out to framework shell wrapper
        this.loginSuccess.emit(response.username);
      },
      error: (err) => {
        console.error('❌ Security block interceptor triggered:', err);
        this.errorMessage = err.error?.detail || 'Authentication failed. Access denied.';
        this.password = ''; // Instantly drop bad verification memory entry tracks
        this.cdr.detectChanges();
      }
    });
  }

  handleLogoFallback(event: Event) {
    const imgElement = event.target as HTMLImageElement;
    imgElement.src = 'assets/logo.png'; 
  }

  handleSignUpSubmission() {
    this.errorMessage = null;
    this.successMessage = null;
    const user = this.signUpUsername.trim();
    const email = this.signUpEmail.trim();
    const pass = this.signUpPass.trim();
    const confirmPass = this.signUpConfirmPass.trim();

    if (!user || !pass || !confirmPass) {
      this.errorMessage = 'Please fill in all required fields.';
      this.cdr.detectChanges();
      return;
    }

    if (pass !== confirmPass) {
      this.errorMessage = 'Passwords do not match.';
      this.cdr.detectChanges();
      return;
    }

    this.apiService.register(user, pass, email).subscribe({
      next: (response) => {
        this.successMessage = 'Registration successful! You can now log in.';
        this.username = user; // Pre-fill login username
        this.password = '';
        
        // Clear fields
        this.signUpUsername = '';
        this.signUpEmail = '';
        this.signUpPass = '';
        this.signUpConfirmPass = '';

        // Switch to login tab
        this.isSignUpActive = false;
        this.cdr.detectChanges();
      },
      error: (err) => {
        console.error('❌ Registration failed:', err);
        this.errorMessage = err.error?.detail || 'Registration failed. Please try again.';
        this.cdr.detectChanges();
      }
    });
  }
}