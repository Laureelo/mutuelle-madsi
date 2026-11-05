/**
 * Réduit une photo avant envoi : une photo de téléphone fait 3 à 6 Mo, ce qui alourdirait la base de données
 * et tous les écrans. L'image est redimensionnée (côté le plus long limité) puis recompressée en JPEG.
 * Une capture de paiement ou un justificatif reste parfaitement lisible à 1200 px (environ 100 à 200 Ko).
 *
 * @param maxCote   taille maximale du plus grand côté, en pixels
 * @param qualite   qualité JPEG de 0 à 1
 * @returns l'image sous forme d'adresse « data:image/jpeg;base64,... »
 */
export function compresserImage(file: File, maxCote = 1200, qualite = 0.72): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('Le fichier choisi n\'est pas une image.'));
      return;
    }
    const lecteur = new FileReader();
    lecteur.onerror = () => reject(new Error('Lecture du fichier impossible.'));
    lecteur.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Image illisible (format non pris en charge).'));
      img.onload = () => {
        const ratio = Math.min(1, maxCote / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * ratio));
        canvas.height = Math.max(1, Math.round(img.height * ratio));
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Traitement de l\'image impossible.'));
          return;
        }
        // fond blanc (les PNG transparents deviendraient noirs en JPEG)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', qualite));
      };
      img.src = lecteur.result as string;
    };
    lecteur.readAsDataURL(file);
  });
}
