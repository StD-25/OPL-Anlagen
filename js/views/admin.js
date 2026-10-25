// Benutzer und Anlagen bearbeiten (Einstellungen).
import * as model from '../model.js';
import { app, esc, setHeader, setActiveTab, toast, confirmDialog } from '../core/ui.js';
import { pickMany } from '../core/picker.js';
import { ROLES } from '../config.js';

const BACK = '#/settings';

// ---- Benutzer ----
export async function renderUser({ id }) {
  const me = await model.getCurrentUser();
  if (!model.can(me, 'users')) { location.hash = BACK; return; }
  const isNew = id === 'new';
  const user = isNew ? { name: '', role: 'benutzer', pin: '', anlagen: [] } : await model.getUser(id);
  if (!user) { location.hash = BACK; return; }
  setHeader(isNew ? 'Neuer Benutzer' : user.name, BACK);
  setActiveTab('settings');

  const anlagen = await model.listAnlagen();
  let chosen = (user.anlagen || []).filter((a) => anlagen.some((x) => x.id === a));

  app().innerHTML = `
    <form id="userForm">
      <label for="name">Name</label>
      <input type="text" id="name" value="${esc(user.name)}" placeholder="Vor- und Nachname">

      <label>Rolle</label>
      <div class="radio-group">
        ${ROLES.map((r) => `<label class="choice"><input type="radio" name="role" value="${r.id}" ${r.id === user.role ? 'checked' : ''}> ${esc(r.label)}</label>`).join('')}
      </div>
      <p class="meta">Administrator: alles, sieht alle Anlagen, verwaltet Benutzer.<br>
        Projektleiter: legt Anlagen an, pflegt Gründe/Gewerke/Personen, darf Berichte löschen.<br>
        Benutzer: Berichte und Punkte erfassen, ändern und löschen.</p>

      <div id="anlagenWrap">
        <label>Zugewiesene Anlagen</label>
        <button type="button" class="picker-field" id="anlagenField"></button>
      </div>

      <label for="pin">PIN <span class="meta">(optional, leer = Anmeldung ohne PIN)</span></label>
      <input type="text" id="pin" inputmode="numeric" autocomplete="off" value="${esc(user.pin || '')}">

      <div class="action-bar">
        <button type="button" class="btn danger" id="cancel">Abbrechen</button>
        <button type="submit" class="btn">Speichern</button>
      </div>
      ${isNew ? '' : '<div class="delete-row"><button type="button" class="btn danger-outline small" id="delete">Benutzer löschen</button></div>'}
    </form>`;

  const field = document.getElementById('anlagenField');
  const labelOf = (aid) => model.anlageLabel(anlagen.find((a) => a.id === aid));
  const renderField = () => {
    field.innerHTML = chosen.length
      ? `<span>${esc(chosen.map(labelOf).join(', '))}</span>`
      : `<span class="placeholder">${anlagen.length ? 'Anlagen auswählen' : 'Noch keine Anlagen angelegt'}</span>`;
  };
  renderField();
  field.onclick = async () => {
    const result = await pickMany({ options: anlagen.map(model.anlageLabel), selected: chosen.map(labelOf), allowAdd: false, rows: 9 });
    if (!result) return;
    chosen = anlagen.filter((a) => result.includes(model.anlageLabel(a))).map((a) => a.id);
    renderField();
  };

  // Administratoren sehen ohnehin alle Anlagen
  const role = () => app().querySelector('input[name="role"]:checked').value;
  const anlagenWrap = document.getElementById('anlagenWrap');
  const updateRole = () => { anlagenWrap.hidden = role() === 'admin'; };
  app().querySelectorAll('input[name="role"]').forEach((r) => { r.onchange = updateRole; });
  updateRole();

  document.getElementById('cancel').onclick = () => { location.hash = BACK; };

  document.getElementById('userForm').onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    if (!name) { toast('Bitte einen Namen eintragen.'); return; }
    const others = (await model.listUsers()).filter((u) => u.id !== user.id);
    if (others.some((u) => u.name.toLowerCase() === name.toLowerCase())) { toast('Diesen Namen gibt es schon.'); return; }
    if (user.role === 'admin' && role() !== 'admin' && !others.some((u) => u.role === 'admin')) {
      toast('Es muss mindestens ein Administrator bleiben.');
      return;
    }
    Object.assign(user, { name, role: role(), pin: document.getElementById('pin').value.trim(), anlagen: chosen });
    await model.saveUser(user);
    toast('Benutzer gespeichert');
    location.hash = BACK;
  };

  const del = document.getElementById('delete');
  if (del) del.onclick = async () => {
    if (user.id === me.id) { toast('Sie können sich nicht selbst löschen.'); return; }
    if (user.role === 'admin' && (await model.countAdmins()) <= 1) { toast('Es muss mindestens ein Administrator bleiben.'); return; }
    if (await confirmDialog(`Wollen Sie den Benutzer „${user.name}“ wirklich löschen?\n\nSeine Berichte und Punkte bleiben erhalten.`, { ok: 'Löschen', danger: true })) {
      await model.deleteUser(user.id);
      toast('Benutzer gelöscht');
      location.hash = BACK;
    }
  };
}

// ---- Anlagen ----
export async function renderAnlage({ id }) {
  const me = await model.getCurrentUser();
  if (!model.can(me, 'anlagen')) { location.hash = BACK; return; }
  const isNew = id === 'new';
  const anlage = isNew ? { nr: '', name: '' } : await model.getAnlage(id);
  if (!anlage) { location.hash = BACK; return; }
  setHeader(isNew ? 'Neue Anlage' : model.anlageLabel(anlage), BACK);
  setActiveTab('settings');

  app().innerHTML = `
    <form id="anlageForm">
      <label for="nr">Anlagennummer</label>
      <input type="text" id="nr" value="${esc(anlage.nr)}" placeholder="z.B. 4711">
      <label for="name">Name der Anlage</label>
      <input type="text" id="name" value="${esc(anlage.name)}" placeholder="z.B. Schweißroboter Linie 2">
      <div class="action-bar">
        <button type="button" class="btn danger" id="cancel">Abbrechen</button>
        <button type="submit" class="btn">Speichern</button>
      </div>
      ${isNew ? '' : '<div class="delete-row"><button type="button" class="btn danger-outline small" id="delete">Anlage löschen</button></div>'}
    </form>`;

  document.getElementById('cancel').onclick = () => { location.hash = BACK; };

  document.getElementById('anlageForm').onsubmit = async (e) => {
    e.preventDefault();
    const nr = document.getElementById('nr').value.trim();
    const name = document.getElementById('name').value.trim();
    if (!nr || !name) { toast('Bitte Nummer und Namen eintragen.'); return; }
    if ((await model.listAnlagen()).some((a) => a.id !== anlage.id && a.nr.toLowerCase() === nr.toLowerCase())) {
      toast('Diese Anlagennummer gibt es schon.');
      return;
    }
    Object.assign(anlage, { nr, name });
    await model.saveAnlage(anlage);
    // Wer eine Anlage anlegt, bekommt sie gleich zugewiesen
    if (isNew && !model.can(me, 'allAnlagen')) {
      me.anlagen = [...(me.anlagen || []), anlage.id];
      await model.saveUser(me);
    }
    toast('Anlage gespeichert');
    location.hash = BACK;
  };

  const del = document.getElementById('delete');
  if (del) del.onclick = async () => {
    const reports = [...await model.listReports('open', anlage.id), ...await model.listReports('archived', anlage.id)];
    if (reports.length) { toast(`Die Anlage hat noch ${reports.length} Berichte und kann nicht gelöscht werden.`, 4000); return; }
    if (await confirmDialog(`Wollen Sie die Anlage „${model.anlageLabel(anlage)}“ wirklich löschen?`, { ok: 'Löschen', danger: true })) {
      await model.deleteAnlage(anlage.id);
      toast('Anlage gelöscht');
      location.hash = BACK;
    }
  };
}
