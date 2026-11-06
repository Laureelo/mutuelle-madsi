import { Injectable, signal } from '@angular/core';

export type ToastType = 'succes' | 'erreur' | 'info' | 'attention';

export interface Toast {
  id: number;
  type: ToastType;
  message: string;
}

export interface DialogOptions {
  titre?: string;
  message: string;
  /** Texte du bouton de validation (« Confirmer » par défaut) */
  confirmer?: string;
  annuler?: string;
  /** Action risquée (suppression, désactivation…) : bouton rouge */
  danger?: boolean;
  /** Icône Bootstrap Icons (sans le préfixe « bi- ») */
  icone?: string;
}

export interface PromptOptions extends DialogOptions {
  label?: string;
  placeholder?: string;
  /** Si vrai, la réponse ne peut pas être vide */
  requis?: boolean;
}

export interface DialogState {
  kind: 'confirm' | 'prompt' | 'alerte';
  options: DialogOptions & PromptOptions;
  resolve: (valeur: any) => void;
}

/**
 * Remplace les fenêtres moches du navigateur (confirm, alert, prompt) par des boîtes de dialogue
 * et des messages (« toasts ») à l'identité de MADSI, lisibles aussi sur téléphone.
 */
@Injectable({ providedIn: 'root' })
export class DialogService {
  readonly dialogue = signal<DialogState | null>(null);
  readonly toasts = signal<Toast[]>([]);
  private prochainId = 1;

  /** Demande une confirmation. Renvoie true si l'utilisateur valide. */
  confirm(options: DialogOptions | string): Promise<boolean> {
    const o: DialogOptions = typeof options === 'string' ? { message: options } : options;
    return this.ouvrir<boolean>('confirm', o, false);
  }

  /** Demande un texte (motif…). Renvoie null si l'utilisateur annule. */
  prompt(options: PromptOptions | string): Promise<string | null> {
    const o: PromptOptions = typeof options === 'string' ? { message: options } : options;
    return this.ouvrir<string | null>('prompt', o, null);
  }

  /** Message important à lire (long, avec détails) : une boîte avec un seul bouton. */
  alerte(message: string, titre = 'Information'): Promise<void> {
    return this.ouvrir<void>('alerte', { titre, message, confirmer: 'Fermer' }, undefined);
  }

  succes(message: string): void { this.toast('succes', message); }
  erreur(message: string): void { this.toast('erreur', message, 8000); }
  info(message: string): void { this.toast('info', message); }
  attention(message: string): void { this.toast('attention', message, 8000); }

  fermerToast(id: number): void {
    this.toasts.update(l => l.filter(t => t.id !== id));
  }

  private toast(type: ToastType, message: string, dureeMs = 5000): void {
    const id = this.prochainId++;
    this.toasts.update(l => [...l.slice(-3), { id, type, message }]);
    setTimeout(() => this.fermerToast(id), dureeMs);
  }

  private ouvrir<T>(kind: DialogState['kind'], options: DialogOptions & PromptOptions, defaut: T): Promise<T> {
    return new Promise<T>(resolve => {
      // une seule boîte à la fois : la précédente est annulée
      this.dialogue()?.resolve(defaut);
      this.dialogue.set({
        kind,
        options,
        resolve: (v: T) => { this.dialogue.set(null); resolve(v); }
      });
    });
  }
}
