// Anmeldung: Benutzer wählen (mit PIN, falls vergeben). Beim ersten Start: ersten Administrator anlegen.
import * as model from '../model.js';
import { app, esc, setHeader, setActiveTab, toast, navigate } from '../core/ui.js';
import { APP_NAME } from '../config.js';

// PIN-Abfrage; löst mit der Eingabe auf oder mit null bei Abbrechen
function askPin(name) {
  return new Promise((resolve) => {
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `
      <div class="dialog" role="dialog">
        <p>Anmelden als <b>${esc(name)}</b></p>
        <label for="pinInput" style="margin-top:0">PIN</label>
        <input type="password" id="pinInput" inputmode="numeric" autocomplete="off">
        <div class="action-bar">
          <button class="btn danger-outline" data-r="0">Abbrechen</button>
          <button class="btn" data-r="1">Anmelden</button>
        </div>
      </div>`;
    const input = ov.querySelector('input');
    const finish = (ok) => { ov.remove(); resolve(ok ? input.value.trim() : null); };
    ov.addEventListener('click', (e) => {
      const r = e.target.dataset?.r;
      if (r !== undefined) finish(r === '1');
    });
    input.onkeydown = (e) => { if (e.key === 'Enter') finish(true); };
    document.body.appendChild(ov);
    input.focus();
  });
}

function renderSetup() {
  app().innerHTML = `
    <div class="card">
      <h2 style="margin-top:0">Willkommen</h2>
      <p>Bitte zuerst den <b>Administrator</b> anlegen. Er legt danach Anlagen und weitere Benutzer an.</p>
      <form id="setup">
        <label for="name">Name</label>
        <input type="text" id="name" autocomplete="name" placeholder="Vor- und Nachname">
        <label for="pin">PIN <span class="meta">(optional, schützt die Anmeldung)</span></label>
        <input type="password" id="pin" inputmode="numeric" autocomplete="new-password" placeholder="z.B. 4 Ziffern">
        <button class="btn block" style="margin-top:18px" type="submit">Administrator anlegen</button>
      </form>
    </div>`;
  document.getElementById('setup').onsubmit = async (e) => {
    e.preventDefault();
    const name = document.getElementById('name').value.trim();
    if (!name) { toast('Bitte einen Namen eintragen.'); return; }
    const user = await model.saveUser({ name, role: 'admin', pin: document.getElementById('pin').value.trim(), anlagen: [] });
    await model.login(user.id);
    toast(`Angemeldet als ${name}`);
    navigate('#/settings');
  };
}

export async function render() {
  setHeader(APP_NAME);
  setActiveTab('');
  const users = await model.listUsers();
  if (!users.length) { renderSetup(); return; }

  app().innerHTML = `
    <h2>Anmelden – wer sind Sie?</h2>
    ${users.map((u) => `
      <div class="card clickable" data-user="${u.id}">
        <div class="title">${esc(u.name)}</div>
        <div class="meta">${esc(model.roleLabel(u.role))}${u.pin ? ' · 🔒 PIN' : ''}</div>
      </div>`).join('')}
    <p class="meta" style="text-align:center">Nicht in der Liste? Bitte beim Administrator melden.</p>`;

  app().querySelectorAll('[data-user]').forEach((el) => {
    el.onclick = async () => {
      const user = users.find((u) => u.id === el.dataset.user);
      if (user.pin) {
        const pin = await askPin(user.name);
        if (pin === null) return;
        if (pin !== user.pin) { toast('Falsche PIN'); return; }
      }
      await model.login(user.id);
      toast(`Angemeldet als ${user.name}`);
      navigate('#/');
    };
  });
}
