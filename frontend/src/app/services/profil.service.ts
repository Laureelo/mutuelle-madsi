import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Membre, MembreUpdate } from '../models/membre.model';

@Injectable({
  providedIn: 'root'
})
export class ProfilService {
  private http = inject(HttpClient);
  private readonly API_URL = environment.apiUrl || 'http://localhost:8080/api';
  private readonly BASE_PATH = `${this.API_URL}/profil`;

  /**
   * Recuperer le profil de l'utilisateur connecte
   */
  getMonProfil(): Observable<Membre> {
    return this.http.get<Membre>(`${this.BASE_PATH}/mon-profil`);
  }

  /**
   * Mettre a jour le profil de l'utilisateur connecte
   */
  updateMonProfil(data: MembreUpdate): Observable<Membre> {
    return this.http.put<Membre>(`${this.BASE_PATH}/mon-profil`, data);
  }

  /**
   * Changer le mot de passe de l'utilisateur connecte
   */
  changerMotDePasse(data: { oldPassword: string; newPassword: string }): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.BASE_PATH}/changer-mot-de-passe`, data);
  }
}
