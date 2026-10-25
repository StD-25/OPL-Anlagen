// Berichts-PDF, Aufgaben-PDF und Bilder-Export.
import * as model from './model.js';
import { tablePdf } from './core/pdf.js';
import { blobToDataURL } from './core/image.js';
import { buildFilename, formatDate, formatDateTime, formatDue, sanitize, stamp } from './core/filename.js';
import { makeZip } from './core/share.js';

// Dateiname beginnt mit der Anlagennummer, z.B. „4711_SafetyWalk_JJJJ-MM-TT_HH-MM_V01.pdf“
const reportFilename = (report, ext, suffix) =>
  `${report.anlageNr ? `${sanitize(report.anlageNr)}_` : ''}${buildFilename(model.reportFileBase(report), report.createdAt, ext, suffix)}`;

async function thumbsFor(pointId) {
  const photos = await model.getPhotos(pointId);
  return Promise.all(
    photos.map(async (ph) => ({ dataURL: await blobToDataURL(ph.thumb), w: ph.thumbW, h: ph.thumbH }))
  );
}

// Status mit Fälligkeit bzw. Erledigt-Datum und der Bemerkung zur Erledigung
const statusText = (p) => {
  if (!p.isTodo) return '–';
  if (p.done) {
    const done = p.doneAt ? `erledigt am\n${formatDate(p.doneAt)}` : 'erledigt';
    return p.doneNote ? `${done}\n\nBemerkung:\n${p.doneNote}` : done;
  }
  return `offen${p.dueDate ? `\nbis ${formatDue(p.dueDate)}` : ''}`;
};

// Datum/Zeit der Erfassung und wer den Punkt erfasst hat
const createdText = (p) => `${formatDateTime(p.createdAt)}${p.author ? `\nvon ${p.author}` : ''}`;

export async function reportPdf(report) {
  const points = (await model.getPoints(report.id)).sort((a, b) => a.no - b.no);
  const rows = [];
  for (const p of points) {
    rows.push({
      cells: [String(p.no), createdText(p), p.gewerk || '', p.remark || '', p.assignee || '', statusText(p), ''],
      images: await thumbsFor(p.id),
    });
  }
  const title = `OPL ${report.anlageNr || ''} – ${model.reportTitle(report)}`;
  const version = model.versionLabel(await model.nextPdfVersion(report, points));
  const open = points.filter((p) => p.isTodo && !p.done).length;
  const done = points.filter((p) => p.isTodo && p.done).length;
  const blob = tablePdf({
    title,
    info: [
      ['Anlage', [report.anlageNr, report.anlageName].filter(Boolean).join(' – ')],
      ['Bericht', model.reportTitle(report)],
      ['Datum', formatDateTime(report.createdAt)],
      ['Angelegt von', report.createdBy],
      ['Version', `${version} · Stand: ${formatDateTime(report.pdfAt)}`],
      ['Punkte', `${points.length} (offen: ${open}, erledigt: ${done})`],
    ],
    columns: [
      { header: 'Nr.', width: 8 },
      { header: 'Erfasst', width: 21 },
      { header: 'Gewerk', width: 29 },
      { header: 'Offener Punkt/Beschreibung' },
      { header: 'Zuständig', width: 21 },
      { header: 'Status', width: 24 },
      { header: 'Foto', width: 22 },
    ],
    rows,
    imageColumn: 6,
  });
  return { blob, filename: reportFilename(report, 'pdf', `_${version}`), title, version };
}

// Originalfotos (separat vom PDF) als ZIP mit gleichem Namensschema.
export async function reportImagesZip(report) {
  const points = await model.getPoints(report.id);
  const entries = [];
  for (const p of points) {
    const photos = await model.getPhotos(p.id);
    photos.forEach((ph, i) => {
      entries.push({
        name: `Punkt${String(p.no).padStart(2, '0')}_${sanitize(p.gewerk || 'Punkt')}_${i + 1}.jpg`,
        blob: ph.full,
      });
    });
  }
  if (!entries.length) return null;
  const blob = await makeZip(entries);
  return { blob, filename: reportFilename(report, 'zip', `_${model.versionLabel(report.pdfVersion || 1)}_Bilder`), count: entries.length };
}

export async function todosPdf(todos, { anlage, gewerk, person, status, search = '' }) {
  const rows = [];
  for (const t of todos) {
    rows.push({
      cells: [
        createdText(t),
        `${t.report.anlageNr || ''}\n${model.reportTitle(t.report)}`,
        t.gewerk || '',
        t.remark || '',
        t.assignee || '',
        statusText(t),
        '',
      ],
      images: await thumbsFor(t.id),
    });
  }
  const who = person || 'Alle';
  const blob = tablePdf({
    title: 'Offene Punkteliste – Aufgaben',
    info: [
      ['Anlage', anlage],
      ['Gewerk', gewerk],
      ['Zuständig', who],
      ['Status', status],
      ...(search ? [['Suche', search]] : []),
      ['Anzahl', String(todos.length)],
    ],
    columns: [
      { header: 'Erfasst', width: 21 },
      { header: 'Anlage / Bericht', width: 20 },
      { header: 'Gewerk', width: 29 },
      { header: 'Offener Punkt/Beschreibung' },
      { header: 'Zuständig', width: 20 },
      { header: 'Status', width: 23 },
      { header: 'Foto', width: 22 },
    ],
    rows,
    imageColumn: 6,
  });
  return { blob, filename: `Aufgaben_${sanitize(who)}_${stamp()}.pdf`, title: `Aufgabenliste – ${who}` };
}
