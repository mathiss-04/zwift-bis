// Vrai home-trainer en Bluetooth : le Zwift Hub One, protocole FTMS.
//
// Module sans DOM : `bluetooth` (l'API Web Bluetooth du navigateur) est
// reçue en paramètre, ce qui permet aux tests de fournir un faux Bluetooth.
// Cette étape ne fait que LIRE les mesures (puissance, cadence) :
// aucune commande n'est envoyée au Hub (étapes 12 et 13).

import { decodeIndoorBikeData } from '../core/ftms-codec.js';

// Identifiants du profil FTMS (Fitness Machine) en Bluetooth Low Energy.
export const FTMS_SERVICE = 0x1826;     // service Fitness Machine
export const INDOOR_BIKE_DATA = 0x2ad2; // mesures du home-trainer

/**
 * Convertit une trame brute (DataView) en texte hexadécimal lisible.
 * Chaque octet devient deux chiffres hexadécimaux en majuscule,
 * séparés par une espace. Exemple : 44 00 E8 03.
 * Une trame vide donne la chaîne vide.
 */
export function frameToHex(dataView) {
  const octets = [];
  for (let i = 0; i < dataView.byteLength; i += 1) {
    const hex = dataView.getUint8(i).toString(16).toUpperCase();
    octets.push(hex.padStart(2, '0')); // un chiffre seul est complété : 4 → 04
  }
  return octets.join(' ');
}

/**
 * Fabrique un trainer connecté au vrai Zwift Hub One.
 *
 * `bluetooth` : API Web Bluetooth (navigator.bluetooth), injectée par le
 * paramètre pour pouvoir être remplacée par un faux dans les tests.
 * `resistanceBytes` : taille du champ résistance dans les trames (1 ou 2
 * octets). Les documents se contredisent ; la valeur sera tranchée avec
 * le vrai matériel à cette étape.
 *
 * Interface renvoyée (identique au simulateur) :
 * connect, disconnect, onData, onRaw, onStatus.
 */
export function createFtmsTrainer({ bluetooth, resistanceBytes = 1 } = {}) {
  // État privé du trainer.
  let device = null;          // Dispositif Bluetooth choisi ; null = déconnecté.
  let characteristic = null;  // Characteristic qui émet les mesures.
  const dataListeners = new Set();   // Abonnés aux mesures { powerW?, cadenceRpm? }.
  const rawListeners = new Set();    // Abonnés aux trames brutes en texte hex.
  const statusListeners = new Set(); // Abonnés aux statuts de connexion.

  // À chaque notification reçue sur la characteristic.
  // `event.target` est la characteristic, dont la propriété `value`
  // contient la trame en DataView.
  function handleValue(event) {
    const dv = event.target.value;

    // 1. Trame brute d'abord, toujours : elle reste visible à l'écran
    //    pour trancher les points ouverts du protocole (ex. résistance).
    const hex = frameToHex(dv);
    for (const callback of rawListeners) {
      callback(hex);
    }

    // 2. Décodage selon la taille retenue pour le champ résistance.
    const decoded = decodeIndoorBikeData(dv, { resistanceBytes });

    // 3. On ne garde que puissance (W) et cadence (tr/min),
    //    et seulement si la trame les contient.
    const data = {};
    if (decoded.powerW !== undefined) data.powerW = decoded.powerW;
    if (decoded.cadenceRpm !== undefined) data.cadenceRpm = decoded.cadenceRpm;

    // 4. On n'émet que si la trame portait au moins une de ces valeurs
    //    (les trames de-only-vitesse ou tronquées ne doivent rien produire).
    if (Object.keys(data).length > 0) {
      for (const callback of dataListeners) {
        callback(data);
      }
    }
  }

  // Retire tous les écouteurs et réinitialise l'état.
  // Appelé en fin de connexion normale, en cas d'échec et en cas de coupure.
  function release() {
    if (characteristic !== null) {
      characteristic.removeEventListener('characteristicvaluechanged', handleValue);
      characteristic = null;
    }
    if (device !== null) {
      device.removeEventListener('gattserverdisconnected', handleDrop);
      device = null;
    }
  }

  // Le Hub a disparu (éteint, hors de portée, repris par Zwift…) :
  // on nettoie puis on signale la déconnexion.
  function handleDrop() {
    release();
    for (const callback of statusListeners) {
      callback('disconnected');
    }
  }

  return {
    // Se connecter au Hub : demander un appareil, ouvrir le service FTMS,
    // écouter les notifications de la characteristic Indoor Bike Data.
    async connect() {
      if (device !== null) return; // Déjà connecté : rien à faire.
      if (!bluetooth) {
        // Browser sans Web Bluetooth : on jette une erreur nommée,
        // l'interface l'expliquera à l'utilisateur.
        const error = new Error('Bluetooth non supporté par ce navigateur.');
        error.name = 'NotSupportedError';
        throw error;
      }

      // Étape 1 : le navigateur ouvre sa fenêtre de choix d'appareil.
      for (const callback of statusListeners) {
        callback('searching');
      }

      let chosen = null; // Appareil choisi, gardé pour le débrancher en cas d'échec.
      try {
        chosen = await bluetooth.requestDevice({ filters: [{ services: [FTMS_SERVICE] }] });

        // Étape 2 : négociation GATT du service FTMS et de sa characteristic.
        for (const callback of statusListeners) {
          callback('connecting');
        }
        device = chosen;
        device.addEventListener('gattserverdisconnected', handleDrop);
        const server = await device.gatt.connect();
        const service = await server.getPrimaryService(FTMS_SERVICE);
        characteristic = await service.getCharacteristic(INDOOR_BIKE_DATA);
        characteristic.addEventListener('characteristicvaluechanged', handleValue);
        await characteristic.startNotifications();

        for (const callback of statusListeners) {
          callback('connected');
        }
      } catch (error) {
        // Quelque chose a échoué : on nettoie, on libère le canal GATT
        // du candidat (le Hub nous y a peut-être branchés), on repasse
        // au repos, puis on relance l'erreur pour que l'interface réagisse.
        release();
        if (chosen !== null) {
          chosen.gatt.disconnect();
        }
        for (const callback of statusListeners) {
          callback('idle');
        }
        throw error;
      }
    },

    // Se déconnecter proprement : retirer les écouteurs, fermer le canal GATT,
    // puis signifier la déconnexion.
    async disconnect() {
      if (device === null) return; // Déjà déconnecté : rien à faire.
      const d = device; // Gardé vivant le temps du débranchement.
      release();
      d.gatt.disconnect();
      for (const callback of statusListeners) {
        callback('disconnected');
      }
    },

    // S'abonner aux mesures { powerW?, cadenceRpm? }.
    // Retourne une fonction qui retire l'abonné.
    onData(callback) {
      dataListeners.add(callback);
      return () => dataListeners.delete(callback);
    },

    // S'abonner aux trames brutes en texte hexadécimal (« 44 00 E8 03 … »).
    // Retourne une fonction qui retire l'abonné.
    onRaw(callback) {
      rawListeners.add(callback);
      return () => rawListeners.delete(callback);
    },

    // S'abonner aux statuts : idle, searching, connecting, connected, disconnected.
    // Retourne une fonction qui retire l'abonné.
    onStatus(callback) {
      statusListeners.add(callback);
      return () => statusListeners.delete(callback);
    },
  };
}
