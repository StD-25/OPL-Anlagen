import * as model from '../model.js';
import { app, esc, setHeader, setActiveTab, toast, navigate } from '../core/ui.js';
import { formatDateTime } from '../core/filename.js';
import { choicePicker } from '../core/choicePicker.js';
import { APP_NAME } from '../config.js';

export async function reportCards(reports) {
  if (!reports.length) return '<p class="empty">Keine Berichte vorhanden.</p>';
  const cards = [];
  for (const r of reports) {
    const points = await model.getPoints(r.id);
    const open = points.filter((p) => p.isTodo && !p.done).length;
    cards.push(`
      <div class="card clickable" data-report="${r.id}">
        <div class="title">${esc(model.reportTitle(r))}</div>
        <div class="meta">${formatDateTime(r.createdAt)} · ${points.length} Punkte
          ${open ? `· <span class="badge open">${open} offen</span>` : points.length ? '· <span class="badge done">alles erledigt</span>' : ''}</div>
        ${r.createdBy ? `<div class="meta">Angelegt von ${esc(r.createdBy)}</div>` : ''}
      </div>`);
  }
  return cards.join('');
}

export function bindReportCards(root) {
  root.querySelectorAll('[data-report]').forEach((el) => {
    el.onclick = () => { location.hash = `#/report/${el.dataset.report}`; };
  });
}

// Anlagenauswahl oben auf Startseite und im Archiv; Wechsel zeichnet die Seite neu
export async function anlageSelect(container, user, hash) {
  const visible = await model.visibleAnlagen(user);
  const current = await model.currentAnlage(user);
  if (!current) {
    container.innerHTML = `<p class="meta" style="margin:0">${model.can(user, 'anlagen')
      ? 'Noch keine Anlage vorhanden. Bitte unter <a href="#/settings">Einstellungen → Anlagen</a> anlegen.'
      : 'Ihnen ist noch keine Anlage zugewiesen. Bitte an den Administrator wenden.'}</p>`;
    return null;
  }
  choicePicker(container, {
    value: model.anlageLabel(current),
    options: visible.map(model.anlageLabel),
    onChange: async (label) => {
      await model.setCurrentAnlage(visible.find((a) => model.anlageLabel(a) === label).id);
      navigate(hash);
    },
  });
  return current;
}

export async function render() {
  setHeader(APP_NAME);
  setActiveTab('home');
  const user = await model.getCurrentUser();
  const reasons = await model.listReasons();
  // Oberer Teil bleibt stehen, nur die Liste der offenen Berichte scrollt
  app().classList.add('split');
  app().innerHTML = `
    <div class="home-top">
    <div class="card">
      <div class="meta">Angemeldet: <b>${esc(user.name)}</b> (${esc(model.roleLabel(user.role))})</div>
      <label style="margin-top:8px">Anlage</label>
      <div id="anlage"></div>
    </div>
    <div class="card" id="newCard">
      <h2 style="margin-top:0">Neuer Bericht</h2>
      <form id="newReport">
        <label for="reason">Grund</label>
        <select id="reason">
          ${reasons.map((r) => `<option value="${esc(r.id)}">${esc(r.label)}</option>`).join('')}
        </select>
        <div id="customWrap" hidden>
          <label for="customName">Name des Berichts</label>
          <input type="text" id="customName" placeholder="z.B. Inbetriebnahme">
        </div>
        <button class="btn block" style="margin-top:16px" type="submit">Bericht starten</button>
      </form>
    </div>
    <a class="btn secondary block link-btn" href="kurz/">✉ Kurznachricht erfassen</a>
    <h2 id="openCount">Offene Berichte</h2>
    </div>
    <div class="home-list" id="reports"></div>`;

  const anlage = await anlageSelect(document.getElementById('anlage'), user, '#/');
  if (!anlage) {
    document.getElementById('newCard').hidden = true;
    app().querySelector('.link-btn').hidden = true;
    document.getElementById('openCount').hidden = true;
    return;
  }
  const reports = await model.listReports('open', anlage.id);
  document.getElementById('openCount').textContent = `Offene Berichte (${reports.length})`;
  document.getElementById('reports').innerHTML = await reportCards(reports);

  const customWrap = document.getElementById('customWrap');
  const reasonSelect = document.getElementById('reason');
  reasonSelect.onchange = () => {
    customWrap.hidden = reasonSelect.value !== 'sonstige';
  };
  document.getElementById('newReport').onsubmit = async (e) => {
    e.preventDefault();
    const reason = reasonSelect.value;
    const customName = document.getElementById('customName').value.trim();
    if (reason === 'sonstige' && !customName) {
      toast('Bitte einen Namen für den Bericht eintragen.');
      return;
    }
    const report = await model.createReport({
      reason,
      reasonLabel: reasons.find((r) => r.id === reason)?.label || '',
      customName,
      anlage,
      user,
    });
    location.hash = `#/report/${report.id}`;
  };
  bindReportCards(app());
}
