import { inject } from '@angular/core';
import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { catchError } from 'rxjs/operators';
import { throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const token = localStorage.getItem('authToken');

  const isAuthRoute = req.url.includes('/api/auth/login') || req.url.includes('/api/auth/register');

  let authReq = req;
  if (token && !isAuthRoute) {
    authReq = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(authReq).pipe(
    catchError((error: any) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        console.warn('⚠️ 401 Unauthorized received. Clearing token and redirecting to login...');
        localStorage.removeItem('authToken');
        localStorage.removeItem('sessionUser');
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
