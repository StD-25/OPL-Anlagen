// Fachlogik: Benutzer, Anlagen, Berichte, Punkte (offene Punkte/Aufgaben), Fotos, Personen, Einstellungen.
import * as db from './core/db.js';
import { REASONS, GEWERKE, ROLES, PHOTO_FULL, PHOTO_THUMB } from './config.js';
import { resizeImage } from './core/image.js';
import { formatDate, formatDateTime, todayISO } from './core/filename.js';

// Fest eingebaute Gründe: „Sonstige“ (freier Name) und „Kurznachricht“ (intern)
const FIXED_REASONS = ['sonstige', 'kurznachricht'];

export function reportTitle(report) {
  if (report.reason === 'kurznachricht') return `Kurznachricht ${formatDate(report.createdAt)}`;
  if (report.reason === 'sonstige') return report.customName || 'Sonstige';
  // Name wird beim Anlegen im Bericht gespeichert, damit spätere Änderungen alte Berichte nicht umbenennen
  return report.reasonLabel || REASONS.find((r) => r.id === report.reason)?.label || 'Bericht';
}

// Grund ohne Datum, z.B. für Filter im Archiv
export const reportGroup = (report) => (report.reason === 'kurznachricht' ? 'Kurznachricht' : reportTitle(report));

// Berichtsname mit Anlage und Datum – bei Kurznachrichten steckt das Datum schon im Titel
export function reportLabel(report) {
  const title = reportTitle(report);
  const withDate = report.reason === 'kurznachricht' ? title : `${title} ${formatDateTime(report.createdAt)}`;
  return report.anlageNr ? `${report.anlageNr} · ${withDate}` : withDate;
}

export const reportFileBase = (report) => (report.reason === 'kurznachricht' ? 'Kurznachricht' : reportTitle(report));

// ---- Gründe der Besprechung (in den Einstellungen änderbar) ----
export async function listEditableReasons() {
  const saved = await getSetting('reasons', null);
  return saved || REASONS.filter((r) => !FIXED_REASONS.includes(r.id)).map(({ id, label }) => ({ id, label }));
}

// Auswahl für „Neuer Bericht“: gepflegte Gründe, „Sonstige“ immer am Ende
export async function listReasons() {
  return [...(await listEditableReasons()), { id: 'sonstige', label: 'Sonstige' }];
}

export const saveReasons = (list) => setSetting('reasons', list);

// ---- Gewerke (in den Einstellungen änderbar) ----
export async function listGewerke() {
  return (await getSetting('gewerke', null)) || [...GEWERKE];
}

export const saveGewerke = (list) => setSetting('gewerke', list);

export const newestFirst = (a, b) => b.createdAt - a.createdAt;

// ---- Benutzer: { id, name, role, pin, anlagen: [anlageId] } ----
export const roleLabel = (role) => ROLES.find((r) => r.id === role)?.label || role;

const RIGHTS = {
  admin: ['users', 'anlagen', 'lists', 'deleteReport', 'backup', 'allAnlagen'],
  projektleiter: ['anlagen', 'lists', 'deleteReport'],
  benutzer: [],
};

// Darf der Benutzer das? users = Benutzerverwaltung, anlagen = Anlagen anlegen,
// lists = Gründe/Gewerke/Personen pflegen, deleteReport, backup, allAnlagen = alle Anlagen sehen
export const can = (user, right) => !!user && !!RIGHTS[user.role]?.includes(right);

export async function listUsers() {
  return ((await getSetting('users', null)) || []).sort((a, b) => a.name.localeCompare(b.name, 'de'));
}

export const getUser = async (id) => (await listUsers()).find((u) => u.id === id) || null;

export async function saveUser(user) {
  const users = await listUsers();
  if (!user.id) user.id = db.uid();
  const i = users.findIndex((u) => u.id === user.id);
  if (i >= 0) users[i] = user; else users.push(user);
  await setSetting('users', users);
  await addPersons([user.name]);
  return user;
}

export async function deleteUser(id) {
  await setSetting('users', (await listUsers()).filter((u) => u.id !== id));
  if ((await getSetting('currentUserId')) === id) await logout();
}

export const countAdmins = async () => (await listUsers()).filter((u) => u.role === 'admin').length;

export async function getCurrentUser() {
  const id = await getSetting('currentUserId');
  return id ? getUser(id) : null;
}

export const login = (id) => setSetting('currentUserId', id);
export const logout = () => setSetting('currentUserId', '');

// ---- Anlagen: { id, nr, name } ----
export const anlageLabel = (a) => (a ? [a.nr, a.name].filter(Boolean).join(' – ') : '');

export async function listAnlagen() {
  return ((await getSetting('anlagen', null)) || [])
    .sort((a, b) => a.nr.localeCompare(b.nr, 'de', { numeric: true }));
}

export const getAnlage = async (id) => (await listAnlagen()).find((a) => a.id === id) || null;

export async function saveAnlage(anlage) {
  const list = await listAnlagen();
  if (!anlage.id) anlage.id = db.uid();
  const i = list.findIndex((a) => a.id === anlage.id);
  if (i >= 0) list[i] = anlage; else list.push(anlage);
  await setSetting('anlagen', list);
  return anlage;
}

export async function deleteAnlage(id) {
  await setSetting('anlagen', (await listAnlagen()).filter((a) => a.id !== id));
  const users = await listUsers();
  for (const u of users) u.anlagen = (u.anlagen || []).filter((a) => a !== id);
  await setSetting('users', users);
}

// Anlagen, die der Benutzer sehen darf (Administrator: alle, sonst die zugewiesenen)
export async function visibleAnlagen(user) {
  const all = await listAnlagen();
  if (can(user, 'allAnlagen')) return all;
  return all.filter((a) => (user?.anlagen || []).includes(a.id));
}

// Auf der Startseite gewählte Anlage (falls nicht mehr erlaubt: erste erlaubte)
export async function currentAnlage(user) {
  const visible = await visibleAnlagen(user);
  const id = await getSetting('currentAnlageId');
  return visible.find((a) => a.id === id) || visible[0] || null;
}

export const setCurrentAnlage = (id) => setSetting('currentAnlageId', id);

// ---- Berichte ----
export async function createReport({ reason, reasonLabel = '', customName, anlage, user }) {
  const report = {
    id: db.uid(),
    reason,
    reasonLabel,
    customName: customName || '',
    anlageId: anlage.id,
    // Nummer und Name merken, damit spätere Umbenennungen alte Berichte nicht ändern
    anlageNr: anlage.nr,
    anlageName: anlage.name,
    createdBy: user?.name || '',
    createdAt: Date.now(),
    status: 'open', // open | archived
    finishedAt: null,
    archivedAt: null,
  };
  await db.put('reports', report);
  return report;
}

export const getReport = (id) => db.get('reports', id);
export const saveReport = (r) => db.put('reports', r);

export async function listReports(status, anlageId) {
  const all = await db.getAll('reports');
  return all.filter((r) => r.status === status && (!anlageId || r.anlageId === anlageId)).sort(newestFirst);
}

export async function deleteReport(id) {
  for (const p of await db.getBy('points', 'reportId', id)) await deletePoint(p.id);
  await db.del('reports', id);
}

// ---- Punkte ----
export async function getPoints(reportId) {
  return (await db.getBy('points', 'reportId', reportId)).sort(newestFirst);
}

export const getPoint = (id) => db.get('points', id);

export async function savePoint(point, { newFiles = [], removedPhotoIds = [] } = {}) {
  if (!point.id) {
    const existing = await db.getBy('points', 'reportId', point.reportId);
    point.id = db.uid();
    point.no = existing.reduce((m, p) => Math.max(m, p.no || 0), 0) + 1;
    point.createdAt = Date.now();
    point.done = false;
    point.doneAt = null;
  }
  for (const pid of removedPhotoIds) await db.del('photos', pid);
  for (const file of newFiles) {
    const full = await resizeImage(file, PHOTO_FULL);
    const thumb = await resizeImage(file, PHOTO_THUMB);
    await db.put('photos', {
      id: db.uid(),
      pointId: point.id,
      reportId: point.reportId,
      createdAt: Date.now(),
      full: full.blob,
      thumb: thumb.blob,
      thumbW: thumb.width,
      thumbH: thumb.height,
    });
  }
  await db.put('points', point);
  if (point.assignee) await addPersons([point.assignee]);
  return point;
}

export async function setDone(point, done, note = '', user = null) {
  point.doneNote = done ? note : '';
  point.done = done;
  point.doneAt = done ? Date.now() : null;
  point.doneBy = done ? user?.name || '' : '';
  return db.put('points', point);
}

export async function deletePoint(id) {
  for (const ph of await db.getBy('photos', 'pointId', id)) await db.del('photos', ph.id);
  await db.del('points', id);
}

export async function getPhotos(pointId) {
  return (await db.getBy('photos', 'pointId', pointId)).sort((a, b) => a.createdAt - b.createdAt);
}

// ---- PDF-Versionen: neue Version nur, wenn sich der Inhalt geändert hat ----
export const versionLabel = (n) => `V${String(n).padStart(2, '0')}`;

export async function nextPdfVersion(report, points) {
  const parts = [report.anlageNr || '', report.anlageName || ''];
  for (const p of [...points].sort((a, b) => a.no - b.no)) {
    const photos = await getPhotos(p.id);
    parts.push([p.no, p.gewerk, p.remark, p.author, p.assignee, p.dueDate, p.isTodo, p.done, p.doneNote || '', photos.length].join('|'));
  }
  const signature = parts.join('\n');
  if (!report.pdfVersion || report.pdfSignature !== signature) {
    report.pdfVersion = (report.pdfVersion || 0) + 1;
    report.pdfSignature = signature;
  }
  report.pdfAt = Date.now();
  await saveReport(report);
  return report.pdfVersion;
}

// Offen und Fälligkeitsdatum überschritten
export const isOverdue = (p) => !!(p.isTodo && !p.done && p.dueDate && p.dueDate < todayISO());

// ---- Kurznachricht: ein Bericht pro Tag und Anlage, jede Nachricht eine offene Aufgabe ----
export async function addQuickMessage({ user, anlage, text, gewerk = '', assignee, dueDate, files = [] }) {
  const today = formatDate(Date.now());
  let report = (await listReports('open', anlage.id))
    .find((r) => r.reason === 'kurznachricht' && formatDate(r.createdAt) === today);
  if (!report) report = await createReport({ reason: 'kurznachricht', anlage, user });
  const point = {
    reportId: report.id,
    gewerk,
    remark: text,
    assignee,
    dueDate: dueDate || '',
    author: user?.name || '',
    isTodo: true,
  };
  return savePoint(point, { newFiles: files });
}

// ---- Einstellungen ----
export async function getSetting(key, fallback = '') {
  const row = await db.get('settings', key);
  return row ? row.value : fallback;
}

export const setSetting = (key, value) => db.put('settings', { key, value });

// ---- Aufgaben (nur aus Berichten der angegebenen Anlagen) ----
export async function listTodos(anlageIds) {
  const [points, reports] = await Promise.all([db.getAll('points'), db.getAll('reports')]);
  const byId = Object.fromEntries(reports.filter((r) => anlageIds.includes(r.anlageId)).map((r) => [r.id, r]));
  return points
    .filter((p) => p.isTodo && byId[p.reportId])
    .map((p) => ({ ...p, report: byId[p.reportId] }))
    .sort(newestFirst);
}

// ---- Personen (für die Zuständigkeit) ----
export function splitNames(text) {
  return String(text || '').split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
}

export async function addPersons(names) {
  for (const name of names) if (name) await db.put('persons', { name });
}

// Alle jemals eingetragenen Personen: Personenliste + Benutzer + Zuständige
export async function listPersons() {
  const [persons, users, points] = await Promise.all([db.getAll('persons'), listUsers(), db.getAll('points')]);
  const names = [
    ...persons.map((p) => p.name),
    ...users.map((u) => u.name),
    ...points.map((p) => p.assignee),
  ].filter(Boolean);
  return [...new Set(names)].sort((a, b) => a.localeCompare(b, 'de'));
}

export const deletePerson = (name) => db.del('persons', name);
