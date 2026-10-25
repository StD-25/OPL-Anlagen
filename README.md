# OPL-Maschine

> Basiert auf der App „Besprechungsprotokoll“ (StD-25/Besprechungs-App) und wird schrittweise zur OPL-App umgebaut.

Web-App (PWA) für eine **offene Punkteliste (OPL)** je Anlage/Maschine – mit Benutzerverwaltung,
Gewerken, Fotos, Zuständigkeiten, Aufgabenliste, PDF-Bericht und Versand per E-Mail.
Alle Daten bleiben lokal auf dem Gerät (offline nutzbar).

## Funktionen
- Anmeldung: Benutzer wählen (optional mit PIN). Beim ersten Start wird der Administrator angelegt.
- Rollen: **Administrator** (alles, sieht alle Anlagen, verwaltet Benutzer und weist Anlagen zu),
  **Projektleiter** (legt Anlagen an, pflegt Gründe/Gewerke/Personen, löscht Berichte),
  **Benutzer** (Berichte und Punkte erfassen, ändern, löschen)
- Anlagen mit Nummer und Name; Auswahl oben auf der Startseite, Berichte gehören zur Anlage
- Neuer Punkt: Gewerk (Elektrik, Mechanik, Programmierung, Projektleitung, Fertigung, Konstruktion),
  Offener Punkt/Beschreibung, Zuständigkeit, Erledigen bis, Fotos; „Erfasst von“ und Datum automatisch
- PDF `4711_SafetyWalk_JJJJ-MM-TT_HH-MM_V01.pdf` mit Anlage, Gewerk, Erfasst von, Status; Bilder separat als ZIP
- Aufgabenliste mit Filter nach Anlage, Gewerk, Person, Status und Suche
- Kurznachricht (zweites Icon „K“): schneller Punkt mit Anlage und Gewerk für den angemeldeten Benutzer
- Archiv je Anlage, Datensicherung (nur Administrator)
