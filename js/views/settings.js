import * as model from '../model.js';
import * as db from '../core/db.js';
import { app, esc, setHeader, setActiveTab, toast, confirmDialog, navigate } from '../core/ui.js';
import { blobToDataURL, dataURLToBlob } from '../core/image.js';
import { download } from '../core/share.js';
import { buildFilename } from '../core/filename.js';
import { listEditor } from '../core/listEditor.js';
import { GEWERKE, APP_VERSION } from '../config.js';

const STORES = ['reports', 'points', 'photos', 'persons', 'settings'];
const openSections = new Set(); // während der Sitzung gemerkt

async function exportBackup() {
  const data = { app: 'opl-maschine', version: 1, exportedAt: Date.now() };
  for (const s of STORES) data[s] = await db.getAll(s);
  data.photos = await Promise.all(data.photos.map(async (p) => ({
    ...p, full: await blobToDataURL(p.full), thumb: await blobToDataURL(p.thumb),
  })));
  const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
  download(blob, buildFilename('Backup OPL-Maschine', new Date(), 'json'));
}

async function importBackup(file) {
  const data = JSON.parse(await file.text());
  if (data.app !== 'opl-maschine') throw new Error('Keine gültige Sicherungsdatei');
  const currentUserId = await model.getSetting('currentUserId');
  for (const s of STORES) {
    for (const item of data[s] || []) {
      if (s === 'photos') {
        item.full = await dataURLToBlob(item.full);
        item.thumb = await dataURLToBlob(item.thumb);
      }
      await db.put(s, item);
    }
  }
  // Angemeldet bleibt, wer gerade angemeldet ist
  await model.setSetting('currentUserId', currentUserId);
}

const section = (id, title, summary, body) => `
  <h2>${title}</h2>
  <div class="card">
    <details id="${id}">
      <summary class="settings-summary">${summary}</summary>
      ${body}
    </details>
  </div>`;

const row = (attr, title, meta) => `
  <div class="card clickable list-row" ${attr}>
    <div class="title">${title}</div>
    ${meta ? `<div class="meta">${meta}</div>` : ''}
  </div>`;

export async function render() {
  setHeader('Einstellungen');
  setActiveTab('settings');
  const me = await model.getCurrentUser();
  const allAnlagen = await model.listAnlagen();
  const myAnlagen = await model.visibleAnlagen(me);
  const labelOf = (id) => model.anlageLabel(allAnlagen.find((a) => a.id === id));

  let html = `
    <h2>Mein Konto</h2>
    <div class="card">
      <div class="title">${esc(me.name)}</div>
      <div class="meta">${esc(model.roleLabel(me.role))}</div>
      <div class="meta" style="margin-top:6px">Meine Anlagen: ${model.can(me, 'allAnlagen') ? 'alle' : esc(myAnlagen.map(model.anlageLabel).join(', ') || 'keine')}</div>
      <button class="btn secondary block" id="logout" style="margin-top:14px">Abmelden / Benutzer wechseln</button>
    </div>`;

  if (model.can(me, 'users')) {
    const users = await model.listUsers();
    html += section('userDetails', 'Benutzerverwaltung', `Benutzer (${users.length}) bearbeiten`, `
      <p class="meta">Rolle und zugewiesene Anlagen festlegen. Antippen zum Bearbeiten.</p>
      <a class="btn block" href="#/user/new" style="margin-bottom:10px">＋ Neuer Benutzer</a>
      ${users.map((u) => row(`data-href="#/user/${u.id}"`, esc(u.name),
        `${esc(model.roleLabel(u.role))} · ${u.role === 'admin' ? 'alle Anlagen' : esc((u.anlagen || []).map(labelOf).filter(Boolean).join(', ') || 'keine Anlage')}`)).join('')}`);
  }

  if (model.can(me, 'anlagen')) {
    const anlagen = model.can(me, 'allAnlagen') ? allAnlagen : myAnlagen;
    html += section('anlageDetails', 'Anlagen', `Anlagen (${anlagen.length}) bearbeiten`, `
      <p class="meta">Nummer und Name der Anlage. Antippen zum Bearbeiten.</p>
      <a class="btn block" href="#/anlage/new" style="margin-bottom:10px">＋ Neue Anlage</a>
      ${anlagen.length ? anlagen.map((a) => row(`data-href="#/anlage/${a.id}"`, esc(model.anlageLabel(a)), '')).join('') : '<p class="empty">Noch keine Anlagen.</p>'}`);
  }

  let persons = [];
  if (model.can(me, 'lists')) {
    const reasons = await model.listEditableReasons();
    const gewerke = await model.listGewerke();
    persons = await model.listPersons();
    html += section('reasonDetails', 'Gründe', `Gründe (${reasons.length}) bearbeiten`, `
      <p class="meta">Auswahl bei „Neuer Bericht“. Namen direkt im Feld ändern. „Sonstige“ (mit freiem Namen) ist immer verfügbar.</p>
      <div id="reasonEditor"></div>`);
    html += section('gewerkDetails', 'Gewerke', `Gewerke (${gewerke.length}) bearbeiten`, `
      <p class="meta">Auswahl bei „Neuer Punkt“ und in der Kurznachricht.</p>
      <div id="gewerkEditor"></div>
      <button type="button" class="btn danger-outline small" id="resetGewerke" style="margin-top:14px">Auf Standard zurücksetzen</button>`);
    html += section('personDetails', 'Personen', `Personen (${persons.length}) bearbeiten`, `
      <p class="meta">Auswahl bei „Zuständigkeit“. Benutzer stehen automatisch in der Liste.</p>
      <form id="addPerson" style="display:flex;gap:8px;margin-top:8px">
        <input type="text" id="personName" placeholder="Name hinzufügen">
        <button class="btn" type="submit">＋</button>
      </form>
      ${persons.length ? persons.map((p) => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--blue-100)">
          <span>${esc(p)}</span><button class="btn danger-outline small" data-del="${esc(p)}">Entfernen</button>
        </div>`).join('') : '<p class="empty">Noch keine Personen.</p>'}`);
  }

  if (model.can(me, 'backup')) {
    html += section('backupDetails', 'Datensicherung', 'Sicherung speichern / laden', `
      <p class="meta">Alle Daten liegen nur auf diesem Gerät. Regelmäßig sichern, z.B. vor einem Handywechsel.</p>
      <div class="btn-row">
        <button class="btn" id="export">Sicherung speichern</button>
        <label class="btn secondary" style="margin:0">Sicherung laden
          <input type="file" id="import" accept="application/json,.json" hidden>
        </label>
      </div>
      <p class="meta" id="storage"></p>`);
  }

  app().innerHTML = `${html}<p class="meta" style="text-align:center">Version ${APP_VERSION}</p>`;

  // Aufgeklappte Abschnitte bleiben nach dem Neuzeichnen offen
  app().querySelectorAll('details[id]').forEach((d) => {
    d.open = openSections.has(d.id);
    d.addEventListener('toggle', () => (d.open ? openSections.add(d.id) : openSections.delete(d.id)));
  });
  app().querySelectorAll('[data-href]').forEach((el) => {
    el.onclick = () => { location.hash = el.dataset.href; };
  });

  document.getElementById('logout').onclick = async () => {
    await model.logout();
    toast('Abgemeldet');
    navigate('#/');
  };

  if (model.can(me, 'lists')) {
    // Gründe und Gewerke: jede Änderung wird sofort gespeichert
    const reasonSummary = app().querySelector('#reasonDetails summary');
    listEditor(document.getElementById('reasonEditor'), {
      items: await model.listEditableReasons(),
      onSave: async (list) => {
        await model.saveReasons(list);
        reasonSummary.textContent = `Gründe (${list.length}) bearbeiten`;
      },
      makeItem: (label) => ({ id: db.uid(), label }),
      noun: 'Grund',
      addPlaceholder: 'Neuen Grund hinzufügen',
    });
    const gewerkSummary = app().querySelector('#gewerkDetails summary');
    const gewerkEditor = listEditor(document.getElementById('gewerkEditor'), {
      items: (await model.listGewerke()).map((label) => ({ label })),
      onSave: async (list) => {
        await model.saveGewerke(list.map((it) => it.label));
        gewerkSummary.textContent = `Gewerke (${list.length}) bearbeiten`;
      },
      noun: 'Gewerk',
      addPlaceholder: 'Neues Gewerk hinzufügen',
    });
    document.getElementById('resetGewerke').onclick = async () => {
      if (await confirmDialog('Gewerke auf die ursprüngliche Liste zurücksetzen?', { ok: 'Zurücksetzen', danger: true })) {
        await model.saveGewerke([...GEWERKE]);
        gewerkEditor.setItems(GEWERKE.map((label) => ({ label })));
        gewerkSummary.textContent = `Gewerke (${GEWERKE.length}) bearbeiten`;
        toast('Gewerke zurückgesetzt');
      }
    };
    document.getElementById('addPerson').onsubmit = async (e) => {
      e.preventDefault();
      const name = document.getElementById('personName').value.trim();
      if (!name) return;
      await model.addPersons([name]);
      render();
    };
    app().querySelectorAll('[data-del]').forEach((b) => {
      b.onclick = async () => {
        if (await confirmDialog(`Wollen Sie „${b.dataset.del}“ wirklich aus der Personenliste löschen?\n\nBestehende Zuweisungen bleiben erhalten.`, { ok: 'Löschen', danger: true })) {
          await model.deletePerson(b.dataset.del);
          render();
        }
      };
    });
  }

  if (model.can(me, 'backup')) {
    document.getElementById('export').onclick = () => exportBackup().catch((e) => toast(e.message));
    document.getElementById('import').onchange = async (e) => {
      try {
        await importBackup(e.target.files[0]);
        toast('Sicherung geladen');
        render();
      } catch (err) {
        toast('Fehler: ' + err.message);
      }
    };
    if (navigator.storage?.estimate) {
      const { usage } = await navigator.storage.estimate();
      const persisted = await navigator.storage.persisted?.();
      document.getElementById('storage').textContent =
        `Belegter Speicher: ${(usage / 1024 / 1024).toFixed(1)} MB${persisted ? ' · dauerhaft gespeichert' : ''}`;
    }
  }
}
