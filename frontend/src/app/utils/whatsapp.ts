/**
 * WhatsApp en envoi MANUEL : l'application ne contacte jamais WhatsApp toute seule.
 * Elle prépare un lien qui ouvre la conversation avec le message déjà écrit ; la personne n'a plus qu'à appuyer sur « Envoyer ».
 */

/** Numéro au format international sans « + » (indicatif du Burkina Faso 226 ajouté aux numéros à 8 chiffres), ou null. */
export function numeroWhatsApp(tel: string | null | undefined): string | null {
  if (!tel) return null;
  let n = tel.replace(/[^\d+]/g, '');
  if (n.startsWith('+')) n = n.slice(1);
  else if (n.startsWith('00')) n = n.slice(2);
  if (n.length === 8) n = '226' + n;
  return /^\d{10,15}$/.test(n) ? n : null;
}

/** Lien WhatsApp vers un numéro (ou, sans numéro, vers le choix d'un contact ou d'un groupe). */
export function lienWhatsApp(tel: string | null | undefined, message: string): string | null {
  const texte = encodeURIComponent(message);
  if (tel === undefined) return `https://wa.me/?text=${texte}`;
  const n = numeroWhatsApp(tel);
  return n ? `https://wa.me/${n}?text=${texte}` : null;
}

const MOIS = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

/** « 2026-07 » devient « juil. 2026 ». */
export function moisEnLettres(periode: string): string {
  const [a, m] = periode.split('-');
  return `${MOIS[(+m || 1) - 1]} ${a}`;
}
