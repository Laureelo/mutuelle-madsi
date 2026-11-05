import { Component, HostListener, effect, inject, ElementRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DialogService } from '../../services/dialog.service';

/** Affiche les boîtes de dialogue et les messages du DialogService. À placer une seule fois, à la racine. */
@Component({
  selector: 'app-dialog-host',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (dialog.dialogue(); as d) {
      <div class="dlg-fond" (click)="annuler()">
        <div class="dlg-boite" role="dialog" aria-modal="true" (click)="$event.stopPropagation()">
          <div class="dlg-corps">
            <div class="dlg-icone" [class.danger]="d.options.danger"
                 [class.question]="!d.options.danger && d.kind !== 'alerte'">
              <i class="bi bi-{{ d.options.icone || (d.options.danger ? 'exclamation-triangle-fill' : (d.kind === 'alerte' ? 'info-circle-fill' : 'question-circle-fill')) }}"></i>
            </div>
            <div class="dlg-texte">
              @if (d.options.titre) { <h2>{{ d.options.titre }}</h2> }
              <p>{{ d.options.message }}</p>
              @if (d.kind === 'prompt') {
                <label class="dlg-label" for="dlg-saisie">{{ d.options.label || 'Votre réponse' }}</label>
                <textarea #saisie id="dlg-saisie" rows="3" class="form-control" [(ngModel)]="texte"
                          [placeholder]="d.options.placeholder || ''" (keydown.control.enter)="valider()"></textarea>
                @if (essaiVide && d.options.requis !== false) { <div class="dlg-err">Ce champ est obligatoire.</div> }
              }
            </div>
          </div>
          <div class="dlg-actions">
            @if (d.kind !== 'alerte') {
              <button type="button" class="btn btn-outline-secondary" (click)="annuler()">{{ d.options.annuler || 'Annuler' }}</button>
            }
            <button type="button" class="btn" [class.btn-danger]="d.options.danger" [class.btn-primary]="!d.options.danger"
                    (click)="valider()">{{ d.options.confirmer || (d.kind === 'alerte' ? 'Fermer' : 'Confirmer') }}</button>
          </div>
        </div>
      </div>
    }

    <div class="toasts" aria-live="polite">
      @for (t of dialog.toasts(); track t.id) {
        <div class="toast-madsi" [class]="'toast-madsi ' + t.type" role="status" (click)="dialog.fermerToast(t.id)">
          <i class="bi" [class.bi-check-circle-fill]="t.type === 'succes'" [class.bi-x-octagon-fill]="t.type === 'erreur'"
             [class.bi-info-circle-fill]="t.type === 'info'" [class.bi-exclamation-triangle-fill]="t.type === 'attention'"></i>
          <span>{{ t.message }}</span>
        </div>
      }
    </div>
  `,
  styles: [`
    .dlg-fond { position: fixed; inset: 0; background: rgba(20, 30, 45, .55); z-index: 2000; display: flex;
      align-items: center; justify-content: center; padding: 16px; animation: fond .15s ease-out; }
    .dlg-boite { background: #fff; color: #2b3440; border-radius: 14px; width: 100%; max-width: 440px;
      box-shadow: 0 20px 50px rgba(0,0,0,.35); overflow: hidden; animation: monte .18s ease-out; }
    .dlg-corps { display: flex; gap: 14px; padding: 22px 22px 8px; }
    .dlg-icone { flex: none; width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center;
      justify-content: center; font-size: 1.4rem; background: #e7f4f5; color: #3d9fa8; }
    .dlg-icone.question { background: #e7f4f5; color: #2f8892; }
    .dlg-icone.danger { background: #fdecea; color: #dc3545; }
    .dlg-texte { flex: 1; min-width: 0; }
    .dlg-texte h2 { font-size: 1.1rem; font-weight: 600; margin: 2px 0 6px; }
    .dlg-texte p { margin: 0 0 8px; white-space: pre-line; line-height: 1.45; }
    .dlg-label { font-size: .85rem; font-weight: 600; margin: 6px 0 4px; display: block; }
    .dlg-err { color: #dc3545; font-size: .8rem; margin-top: 4px; }
    .dlg-actions { display: flex; justify-content: flex-end; gap: 10px; padding: 14px 22px 18px; }
    @media (max-width: 480px) {
      .dlg-fond { align-items: flex-end; padding: 0; }
      .dlg-boite { max-width: none; border-radius: 16px 16px 0 0; }
      .dlg-actions { flex-direction: column-reverse; }
      .dlg-actions .btn { width: 100%; padding: 10px; }
    }
    .toasts { position: fixed; top: 70px; right: 16px; z-index: 2100; display: flex; flex-direction: column; gap: 8px;
      width: min(380px, calc(100vw - 32px)); pointer-events: none; }
    .toast-madsi { pointer-events: auto; display: flex; gap: 10px; align-items: flex-start; padding: 12px 14px; border-radius: 10px;
      background: #fff; color: #2b3440; box-shadow: 0 8px 24px rgba(0,0,0,.2); border-left: 5px solid #3d9fa8;
      white-space: pre-line; line-height: 1.4; cursor: pointer; animation: glisse .2s ease-out; }
    .toast-madsi i { font-size: 1.15rem; margin-top: 1px; }
    .toast-madsi.succes { border-left-color: #198754; } .toast-madsi.succes i { color: #198754; }
    .toast-madsi.erreur { border-left-color: #dc3545; } .toast-madsi.erreur i { color: #dc3545; }
    .toast-madsi.attention { border-left-color: #e89a3c; } .toast-madsi.attention i { color: #e89a3c; }
    .toast-madsi.info i { color: #3d9fa8; }
    @media (max-width: 576px) { .toasts { top: auto; bottom: 12px; right: 16px; left: 16px; width: auto; } }
    @keyframes fond { from { opacity: 0; } to { opacity: 1; } }
    @keyframes monte { from { transform: translateY(12px) scale(.98); opacity: 0; } to { transform: none; opacity: 1; } }
    @keyframes glisse { from { transform: translateX(20px); opacity: 0; } to { transform: none; opacity: 1; } }
  `]
})
export class DialogHostComponent {
  dialog = inject(DialogService);
  texte = '';
  essaiVide = false;
  private saisie = viewChild<ElementRef<HTMLTextAreaElement>>('saisie');

  constructor() {
    // à chaque nouvelle boîte : on vide le champ et on met le curseur dedans
    effect(() => {
      const d = this.dialog.dialogue();
      this.texte = '';
      this.essaiVide = false;
      if (d?.kind === 'prompt') setTimeout(() => this.saisie()?.nativeElement.focus(), 50);
    });
  }

  valider(): void {
    const d = this.dialog.dialogue();
    if (!d) return;
    if (d.kind === 'prompt') {
      const v = this.texte.trim();
      if (!v && d.options.requis !== false) { this.essaiVide = true; return; }
      d.resolve(v);
    } else {
      d.resolve(d.kind === 'confirm' ? true : undefined);
    }
  }

  annuler(): void {
    const d = this.dialog.dialogue();
    if (!d) return;
    d.resolve(d.kind === 'confirm' ? false : d.kind === 'prompt' ? null : undefined);
  }

  @HostListener('document:keydown.escape')
  echap(): void { this.annuler(); }
}
