// Kurznachricht: schnell einen offenen Punkt erfassen.
// Nutzt dieselbe Datenbank und Anmeldung wie die Haupt-App OPL-Maschine.
import * as model from '../js/model.js';
import { esc, toast, objectURL, releaseObjectURLs } from '../js/core/ui.js';
import { formatDateTime } from '../js/core/filename.js';
import { singlePerson } from '../js/core/personPicker.js';
import { choicePicker } from '../js/core/choicePicker.js';
import { registerServiceWorker } from '../js/core/swUpdate.js';

const $ = (id) => document.getElementById(id);
let user;
let anlagen = [];
let anlage;
let gewerk;
let assignee;
let files = [];

async function fill() {
  $('stamp').textContent = formatDateTime(Date.now());
  user = await model.getCurrentUser();
  $('loginHint').hidden = !!user;
  $('quickForm').hidden = !user;
  if (!user) return;
  $('author').innerHTML = `Erfasst von <b>${esc(user.name)}</b>`;
  anlagen = await model.visibleAnlagen(user);
  const current = anlage?.getValue() || model.anlageLabel(await model.currentAnlage(user));
  anlage = choicePicker($('anlagePicker'), {
    value: current,
    options: anlagen.map(model.anlageLabel),
    placeholder: anlagen.length ? 'Anlage auswählen' : 'Keine Anlage zugewiesen',
  });
  const currentGewerk = gewerk?.getValue() || '';
  gewerk = choicePicker($('gewerkPicker'), { value: currentGewerk, options: await model.listGewerke(), placeholder: 'Gewerk auswählen' });
  const currentAssignee = assignee?.getValue() || '';
  assignee = singlePerson($('assigneePicker'), { value: currentAssignee, persons: await model.listPersons(), id: 'assignee' });
}

function renderPhotos() {
  releaseObjectURLs();
  $('photos').innerHTML = files.map((f, i) => `
    <div class="ph"><img class="thumb" src="${objectURL(f)}" alt=""><button type="button" data-i="${i}" aria-label="Foto entfernen">×</button></div>`).join('');
  $('photos').querySelectorAll('button[data-i]').forEach((b) => {
    b.onclick = () => { files.splice(Number(b.dataset.i), 1); renderPhotos(); };
  });
}

for (const id of ['camera', 'gallery']) {
  $(id).onchange = () => {
    files.push(...$(id).files);
    $(id).value = '';
    renderPhotos();
  };
}

function reset() {
  $('text').value = '';
  $('dueDate').value = '';
  gewerk.reset();
  assignee.reset();
  files = [];
  renderPhotos();
  fill();
}

$('cancel').onclick = () => {
  reset();
  toast('Verworfen');
};

$('quickForm').onsubmit = async (e) => {
  e.preventDefault();
  const text = $('text').value.trim();
  const chosen = anlagen.find((a) => model.anlageLabel(a) === anlage.getValue());
  if (!chosen) {
    toast('Bitte eine Anlage auswählen.');
    return;
  }
  if (!text) {
    toast('Bitte einen offenen Punkt/eine Beschreibung eingeben.');
    $('text').focus();
    return;
  }
  $('save').disabled = true;
  $('save').textContent = 'Speichert …';
  try {
    await model.addQuickMessage({
      user,
      anlage: chosen,
      text,
      gewerk: gewerk.getValue(),
      assignee: assignee.getValue(),
      dueDate: $('dueDate').value,
      files,
    });
    await model.setCurrentAnlage(chosen.id);
    toast('Gespeichert – als offene Aufgabe übernommen');
    reset();
  } catch (err) {
    console.error(err);
    toast('Fehler beim Speichern: ' + err.message, 4000);
  } finally {
    $('save').disabled = false;
    $('save').textContent = 'Speichern';
  }
};

// Uhrzeit aktuell halten, solange das Fenster offen ist
setInterval(() => { $('stamp').textContent = formatDateTime(Date.now()); }, 30000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) fill(); });

fill();
navigator.storage?.persist?.();
registerServiceWorker('../service-worker.js', '../');
