// Module de lecture des séances Zwift (étape 3).
// À partir du texte XML d'un fichier .zwo, produit une liste de blocs
// au format unique { source, type, durationS, powerStart, powerEnd }.
//
// L'analyse est faite à la main avec des expressions régulières :
// pas de DOMParser, pas de DOM, pas de dépendance — ça tourne sous Node.
//
// Module pur : pas d'écran, pas de Bluetooth, pas de classe, pas d'import.

/**
 * Décode les entités XML dans une chaîne.
 * Un seul passage : `&amp;lt;` devient `&lt;` (et non `<`), car le
 * texte de remplacement n'est jamais re-scanné par la regex.
 */
export function decodeEntities(text) {
  const entities = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
  return text.replace(/&(amp|lt|gt|quot|apos);/g, (tout, nom) => entities[nom]);
}

/**
 * Analyse le texte des attributs d'une balise.
 * Retourne un objet nom → valeur (chaîne décodée par decodeEntities).
 * Les guillemets simples et doubles sont acceptés : la valeur est dans
 * le groupe 3 (guillemets doubles) ou le groupe 4 (guillemets simples).
 */
export function parseAttributes(text) {
  const attrs = {};
  const attrRe = /([A-Za-z_][\w-]*)\s*=\s*("([^"]*)"|'([^']*)')/g;
  for (const m of text.matchAll(attrRe)) {
    attrs[m[1]] = decodeEntities(m[3] ?? m[4]);
  }
  return attrs;
}

/**
 * Contenu de la première balise `name` dans le XML.
 * Les espaces autour sont retirés, puis le texte est décodé.
 * Chaîne vide si la balise n'existe pas.
 */
export function tagText(xml, name) {
  const re = new RegExp(`<${name}\\b[^>]*>([\\s\\S]*?)</${name}>`);
  const m = xml.match(re);
  return m ? decodeEntities(m[1].trim()) : '';
}

/**
 * (Non exportée.) Renvoie l'attribut `name` en nombre.
 * Lève une erreur si l'attribut est absent, vide, ou s'il ne représente
 * pas un nombre fini (ex. "x" → NaN).
 */
function numberAttr(attrs, name, tag) {
  const raw = attrs[name];
  const value = Number(raw);
  if (raw === undefined || raw === '' || !Number.isFinite(value)) {
    throw new Error(`.zwo invalide : ${tag} sans ${name} valide`);
  }
  return value;
}

/**
 * Analyse un fichier .zwo (XML) et retourne { name, description, blocks }.
 * Les puissances (powerStart, powerEnd) sont des fractions de la FTP.
 */
export function parseZwo(xml) {
  // 1. On retire les commentaires : ils ne font pas partie de la séance.
  const clean = xml.replace(/<!--[\s\S]*?-->/g, '');

  // 2. Contenu de la balise <workout>.
  //    Le \b (limite de mot) évite de confondre avec <workout_file>,
  //    car `_` compte comme une lettre du mot.
  const workoutMatch = clean.match(/<workout\b[^>]*>([\s\S]*?)<\/workout>/);
  if (!workoutMatch) {
    throw new Error('.zwo invalide : balise <workout> absente');
  }
  const workout = workoutMatch[1];

  // 3. On parcourt les balises reconnues, dans l'ordre du fichier.
  //    m[1] = nom de la balise, m[2] = texte de ses attributs.
  const blocks = [];
  const tagRe = /<(SteadyState|Warmup|Cooldown|Ramp|IntervalsT|FreeRide)\b([^>]*?)\/?>/g;

  for (const m of workout.matchAll(tagRe)) {
    const tag = m[1];
    const attrs = parseAttributes(m[2]);

    if (tag === 'SteadyState') {
      // Puissance fixe : Power, ou PowerLow si Power est absent.
      const durationS = numberAttr(attrs, 'Duration', tag);
      const power = attrs.Power === undefined || attrs.Power === ''
        ? numberAttr(attrs, 'PowerLow', tag)
        : numberAttr(attrs, 'Power', tag);
      blocks.push({ source: tag, type: 'steady', durationS, powerStart: power, powerEnd: power });
    } else if (tag === 'Warmup' || tag === 'Cooldown' || tag === 'Ramp') {
      // Puissance qui varie de PowerLow à PowerHigh.
      // On ne les échange jamais, même si PowerHigh < PowerLow (récupération).
      const durationS = numberAttr(attrs, 'Duration', tag);
      const powerStart = numberAttr(attrs, 'PowerLow', tag);
      const powerEnd = numberAttr(attrs, 'PowerHigh', tag);
      blocks.push({ source: tag, type: 'ramp', durationS, powerStart, powerEnd });
    } else if (tag === 'FreeRide') {
      // Roule libre, sans cible de puissance.
      const durationS = numberAttr(attrs, 'Duration', tag);
      blocks.push({ source: tag, type: 'free', durationS, powerStart: null, powerEnd: null });
    } else {
      // IntervalsT : Repeat fois un « on » puis un « off ».
      const repeat = numberAttr(attrs, 'Repeat', tag);
      const onDuration = numberAttr(attrs, 'OnDuration', tag);
      const offDuration = numberAttr(attrs, 'OffDuration', tag);
      const onPower = numberAttr(attrs, 'OnPower', tag);
      const offPower = numberAttr(attrs, 'OffPower', tag);
      for (let i = 0; i < repeat; i++) {
        blocks.push({ source: tag, type: 'steady', durationS: onDuration, powerStart: onPower, powerEnd: onPower });
        blocks.push({ source: tag, type: 'steady', durationS: offDuration, powerStart: offPower, powerEnd: offPower });
      }
    }
  }

  // 5. Une séance sans aucun bloc est invalide.
  if (blocks.length === 0) {
    throw new Error('.zwo invalide : aucun bloc');
  }

  // 6. Nom et description (appliqués au texte sans commentaires).
  const name = tagText(clean, 'name');
  const description = tagText(clean, 'description');

  return { name, description, blocks };
}

/**
 * Durée totale de la séance, en secondes : somme des durationS.
 */
export function totalDurationS(blocks) {
  return blocks.reduce((total, b) => total + b.durationS, 0);
}
