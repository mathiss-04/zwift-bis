// Module de statistiques (étape 2) : moyenne de puissance, puissance
// normalisée et dénivelé positif d'une sortie.
//
// Module pur : pas d'écran, pas de Bluetooth, pas de classe, pas d'import.
//
// Unités : puissance en W, altitude en m.
// Les tableaux de puissance contiennent une valeur par seconde (1 Hz).

/**
 * Moyenne arithmétique d'un tableau de valeurs.
 * Formule : moyenne = (somme des valeurs) / (nombre de valeurs).
 * Tableau vide : 0 (pour éviter une division par zéro).
 */
export function mean(values) {
  if (values.length === 0) return 0;
  let somme = 0;
  for (const v of values) {
    somme += v;
  }
  return somme / values.length;
}

/**
 * Moyenne des `n` dernières valeurs de puissance (W), par exemple les 3 s.
 * Formule : moyenne = mean(values.slice(-n)).
 * S'il y a moins de n valeurs, slice(-n) renvoie tout le tableau :
 * on fait donc la moyenne de celles qui existent.
 * Sert à la « puissance 3 s » affichée à l'écran.
 */
export function trailingAverage(values, n = 3) {
  return mean(values.slice(-n));
}

/**
 * Puissance normalisée (W) : une moyenne qui pénalise les pics d'effort.
 * Formule : NP = ( (1/N) × Σ moyenne30s⁴ )^(1/4)
 * où moyenne30s est la moyenne glissante sur 30 valeurs (30 s à 1 Hz)
 * et N est le nombre de fenêtres complètes.
 * Moins de 30 valeurs : aucune fenêtre complète possible, retourne 0.
 */
export function normalizedPower(powers) {
  if (powers.length < 30) return 0;

  const fenetre = 30; // 30 valeurs = 30 s (une valeur par seconde)
  let sommeFenetre = 0; // somme courante des valeurs dans la fenêtre
  let sommePuissance4 = 0; // accumulateur des moyennes élevées à la 4e
  let nbFenetres = 0;

  for (let i = 0; i < powers.length; i++) {
    sommeFenetre += powers[i]; // on ajoute la nouvelle valeur
    if (i >= fenetre) {
      // On retire la valeur qui sort de la fenêtre (glissement en O(1)).
      sommeFenetre -= powers[i - fenetre];
    }
    if (i >= fenetre - 1) {
      // Fenêtre complète (la première couvre les indices 0 à 29).
      const moyenne = sommeFenetre / fenetre;
      sommePuissance4 += Math.pow(moyenne, 4);
      nbFenetres += 1;
    }
  }

  // Racine quatrième de la moyenne des moyennes⁴.
  return Math.pow(sommePuissance4 / nbFenetres, 0.25);
}

/**
 * Dénivelé positif (m) d'un profil d'altitude.
 * Formule : somme de (altitudes[i] − altitudes[i−1]) pour chaque variation positive.
 * Les descentes ne sont pas comptées : elles ne compensent pas la montée.
 * Moins de 2 points : 0.
 */
export function ascentM(altitudes) {
  if (altitudes.length < 2) return 0;
  let monteeM = 0;
  for (let i = 1; i < altitudes.length; i++) {
    const deltaM = altitudes[i] - altitudes[i - 1]; // variation d'altitude (m)
    if (deltaM > 0) {
      monteeM += deltaM;
    }
  }
  return monteeM;
}
