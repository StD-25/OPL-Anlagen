// Anpassbare Konfiguration – für weitere Programme hier Gründe/Gewerke ändern.
export const APP_NAME = 'OPL-Maschine';

// Bei jeder Änderung zusammen mit CACHE in service-worker.js erhöhen
export const APP_VERSION = '2026-10-26.2';

export const REASONS = [
  { id: 'safetywalk', label: 'Safety Walk', file: 'SafetyWalk' },
  { id: 'poolmanager', label: 'Poolmanager Besprechung', file: 'PoolmanagerBesprechung' },
  { id: 'reko', label: 'Reko Produktion', file: 'RekoProduktion' },
  { id: 'sonstige', label: 'Sonstige', file: null }, // Name wird frei eingetragen
  // Wird nur über die Kurznachricht-App angelegt, nicht im Formular „Neuer Bericht“
  { id: 'kurznachricht', label: 'Kurznachricht', file: 'Kurznachricht', hidden: true },
];

// Gewerk eines Punkts (in den Einstellungen änderbar)
export const GEWERKE = ['Elektrik', 'Mechanik', 'Programmierung', 'Projektleitung', 'Fertigung', 'Konstruktion'];

// Rollen der Benutzerverwaltung
export const ROLES = [
  { id: 'admin', label: 'Administrator' },
  { id: 'projektleiter', label: 'Projektleiter' },
  { id: 'benutzer', label: 'Benutzer' },
];

// Bildgrößen: Original für den Bilder-Export, Thumbnail für das PDF.
export const PHOTO_FULL = { maxPx: 1600, quality: 0.8 };
export const PHOTO_THUMB = { maxPx: 240, quality: 0.5 };
