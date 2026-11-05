import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { LoginRequest, LoginResponse, RegisterRequest, RegisterResponse, AuthUser } from '../models/auth.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private readonly API_URL = environment.apiUrl || 'http://localhost:8080/api';
  private readonly TOKEN_KEY = 'auth_token';
  private readonly USER_KEY = 'current_user';

  private currentUserSubject = new BehaviorSubject<LoginResponse | null>(this.getCurrentUser());
  public currentUser$ = this.currentUserSubject.asObservable();

  login(credentials: LoginRequest): Observable<LoginResponse> {
    return this.http.post<LoginResponse>(`${this.API_URL}/auth/login`, credentials)
      .pipe(
        tap(response => {
          this.setToken(response.token);
          this.setCurrentUser(response);
          this.currentUserSubject.next(response);
        })
      );
  }

  register(data: RegisterRequest): Observable<RegisterResponse> {
    return this.http.post<RegisterResponse>(`${this.API_URL}/auth/register`, data);
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUserSubject.next(null);
  }

  getToken(): string | null {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      return localStorage.getItem(this.TOKEN_KEY);
    }
    return null;
  }

  /** Connecté = jeton présent ET non expiré (la date d'expiration est lue dans le jeton). */
  isAuthenticated(): boolean {
    const token = this.getToken();
    if (!token) return false;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      if (payload.exp && payload.exp * 1000 < Date.now()) {
        this.logout();
        return false;
      }
    } catch {
      // jeton illisible : on laisse le serveur trancher (réponse 401 -> déconnexion)
    }
    return true;
  }

  /**
   * Relit auprès du serveur le rôle et l'état du compte (un administrateur a pu activer le compte
   * ou changer le rôle depuis la dernière connexion).
   */
  refreshSession(): Observable<any> {
    return this.http.get<any>(`${this.API_URL}/auth/me`).pipe(
      tap(me => {
        if (!me?.authenticated) {
          this.logout();
          return;
        }
        const current = this.getCurrentUser();
        if (current) {
          this.refreshCurrentUser({ ...current, roles: me.roles, id: me.id, username: me.username });
        }
      })
    );
  }

  hasRole(role: string): boolean {
    const user = this.getCurrentUser();
    return user?.roles?.includes(role) || false;
  }

  hasAnyRole(roles: string[]): boolean {
    const user = this.getCurrentUser();
    if (!user?.roles) return false;
    return roles.some(role => user.roles.includes(role));
  }

  private setToken(token: string): void {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem(this.TOKEN_KEY, token);
    }
  }

  private setCurrentUser(user: LoginResponse): void {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      localStorage.setItem(this.USER_KEY, JSON.stringify(user));
    }
  }

  getCurrentUser(): LoginResponse | null {
    if (typeof window !== 'undefined' && typeof localStorage !== 'undefined') {
      const userJson = localStorage.getItem(this.USER_KEY);
      return userJson ? JSON.parse(userJson) : null;
    }
    return null;
  }

  /**
   * Rafraichir les donnees de l'utilisateur courant
   */
  refreshCurrentUser(user: LoginResponse): void {
    this.setCurrentUser(user);
    this.currentUserSubject.next(user);
  }
}
