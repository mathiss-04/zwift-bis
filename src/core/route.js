// Module de parcours en mémoire (étape 5) : à partir d'un parcours déjà
// chargé, donne la position, l'altitude et la pente à n'importe quelle
// distance, et compte les tours sur une boucle.
//
// Module pur : pas de lecture de fichier, pas de fetch, pas de classe,
// pas d'import. Le chargement du fichier route.json est l'étape 20.
//
// Unités : distances et altitudes en m, pente (grade) en fraction
// (0.05 = 5 %), latitude et longitude en degrés.
//
// Format d'un parcours :
//   { isLoop, lengthM, stepM, x, z, alt, grade, lat?, lon? }
// Le point i se trouve à la distance i × stepM. Le pas constant permet
// de trouver le bon point par un simple calcul, sans parcourir le tableau.

/**
 * Valide la forme d'un parcours et le renvoie tel quel.
 * Lances une Error au premier problème, dans cet ordre :
 * 1. stepM doit être strictement positif.
 * 2. alt doit exister et contenir au moins 2 points.
 * 3. Chaque colonne x, z, alt, grade doit être un tableau de la même longueur que alt.
 * 4. lengthM doit correspondre à (n − 1) × stepM, où n est le nombre de points.
 */
export function validateRoute(route) {
  // 1. Pas entre deux points : doit être un nombre strictement positif.
  if (!(route.stepM > 0)) {
    throw new Error('Parcours invalide : stepM doit être positif');
  }

  // 2. L'altitude sert de référence pour le nombre de points.
  if (!Array.isArray(route.alt) || route.alt.length < 2) {
    throw new Error('Parcours invalide : au moins 2 points requis');
  }

  // 3. Toutes les colonnes doivent avoir la même longueur que alt.
  for (const colonne of ['x', 'z', 'alt', 'grade']) {
    if (!Array.isArray(route[colonne]) || route[colonne].length !== route.alt.length) {
      throw new Error(`Parcours invalide : colonne ${colonne} de mauvaise longueur`);
    }
  }

  // 4. La longueur totale doit correspondre au nombre de segments.
  //    n − 1 segments de stepM : longueur théorique = (n − 1) × stepM (m).
  const n = route.alt.length; // nombre de points
  const longueurTheoriqueM = (n - 1) * route.stepM;
  if (Math.abs(route.lengthM - longueurTheoriqueM) > 0.001) {
    throw new Error('Parcours invalide : lengthM ne correspond pas à stepM');
  }

  return route;
}

/**
 * Décompose une distance (m) parcourue en tour et position dans le tour.
 * Une distance négative est ramenée au départ (0).
 * Boucle (isLoop) : lap = nombre de tours entiers, posM = reste dans le tour.
 * Sans boucle : lap = 0, posM = distance plafonnée à lengthM (on reste
 * au dernier point).
 */
export function locate(route, distanceM) {
  const d = Math.max(0, distanceM); // distance effective (m)
  if (route.isLoop) {
    const lap = Math.floor(d / route.lengthM); // nombre de tours complets
    const posM = d - lap * route.lengthM; // position dans le tour courant (m)
    return { lap, posM };
  }
  return { lap: 0, posM: Math.min(d, route.lengthM) };
}

/**
 * Interpolation linéaire entre a et b.
 * Formule : a + (b − a) × t, avec t entre 0 (valeur a) et 1 (valeur b).
 */
export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/**
 * Point du parcours à une distance (m) donnée, avec le tour courant.
 * Le point i est à i × stepM : on déduit i et la fraction t du segment,
 * puis on interpole x, z, alt et grade entre les points i et i + 1.
 * Le min(…, n − 2) garde un segment valide tout au bout d'un parcours
 * sans boucle (où posM peut être égal à lengthM).
 * Si le parcours porte des colonnes lat et lon, le résultat les ajoute,
 * interpolées de la même façon.
 */
export function pointAt(route, distanceM) {
  const { lap, posM } = locate(route, distanceM);

  const n = route.alt.length; // nombre de points
  const i = Math.min(Math.floor(posM / route.stepM), n - 2); // segment i → i + 1
  const t = posM / route.stepM - i; // fraction du segment (0 à 1)

  const point = {
    lap,
    posM,
    x: lerp(route.x[i], route.x[i + 1], t),
    z: lerp(route.z[i], route.z[i + 1], t),
    alt: lerp(route.alt[i], route.alt[i + 1], t),
    grade: lerp(route.grade[i], route.grade[i + 1], t),
  };

  // Géolocalisation facultative : n'existante que si le parcours la porte.
  if (route.lat && route.lon) {
    point.lat = lerp(route.lat[i], route.lat[i + 1], t);
    point.lon = lerp(route.lon[i], route.lon[i + 1], t);
  }

  return point;
}
