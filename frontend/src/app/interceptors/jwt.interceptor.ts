import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** Connexion et inscription : pas de jeton à envoyer, et un 401 y signifie « identifiants incorrects ». */
const estRequeteDeConnexion = (url: string) =>
  url.includes('/auth/login') || url.includes('/auth/register');

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const token = authService.getToken();

  if (token && !estRequeteDeConnexion(req.url)) {
    req = req.clone({
      setHeaders: {
        Authorization: `Bearer ${token}`
      }
    });
  }

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // Session expirée, compte désactivé ou jeton invalide : retour à la connexion
      if (error.status === 401 && !estRequeteDeConnexion(req.url)) {
        authService.logout();
        router.navigate(['/login']);
      }
      return throwError(() => error);
    })
  );
};
