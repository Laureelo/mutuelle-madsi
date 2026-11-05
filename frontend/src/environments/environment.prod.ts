// Environnement de production : l'application web est servie par le même serveur que l'API,
// les appels se font donc en adresse relative (aucune adresse à configurer).
export const environment = {
  production: true,
  apiUrl: '/api'
};
