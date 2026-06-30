import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { ApiService } from '../services/api.service';

export const authGuard: CanActivateFn = (route, state) => {
  const apiService = inject(ApiService);
  const router = inject(Router);

  const token = localStorage.getItem('authToken');
  if (apiService.isTokenValid(token)) {
    return true;
  }

  router.navigate(['/login']);
  return false;
};
