import { BACKUP_LIMIT, createBackup, parseBackup, backupSummary } from './backup.js';

export function mountBackupPage({ getState, onImport }) {
  const $ = id => document.getElementById(id);
  let pending = null, readId = 0;
  function status(message, error = false) {
    $('transfer-status').textContent = message;
    $('transfer-status').classList.toggle('error', error);
    $('transfer-status').hidden = !message;
  }
  function summary(state, prefix) {
    const values = backupSummary(state);
    for (const field of ['events', 'absences', 'subjects', 'groups', 'filename']) $(`${prefix}-${field}`).textContent = values[field];
  }
  function clearPending() {
    pending = null; readId++;
    $('backup-preview').hidden = true;
    $('backup-file').value = '';
  }
  summary(getState(), 'export');
  window.addEventListener('hashchange', () => {
    if (location.hash === '#export') summary(getState(), 'export');
  });
  $('backup-download').addEventListener('click', () => {
    try {
      const now = new Date();
      const backup = createBackup(getState(), now);
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a');
      const date = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
      link.href = url; link.download = `campus-core-${date}.json`;
      document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      status('Die Sicherung wurde zum Download bereitgestellt.');
    } catch { status('Die Daten konnten nicht exportiert werden. Der aktuelle Kalender bleibt erhalten.', true); }
  });
  $('backup-choose').addEventListener('click', () => $('backup-file').click());
  $('backup-file').addEventListener('change', async event => {
    const file = event.target.files[0];
    if (!file) return;
    clearPending();
    const currentRead = readId;
    $('backup-choose').disabled = true;
    status('Sicherung wird geprüft …');
    try {
      if (file.size > BACKUP_LIMIT) throw new Error('Die Sicherung darf maximal 20 MB groß sein.');
      const backup = parseBackup(await file.text());
      if (currentRead !== readId) return;
      pending = backup.attendance;
      summary(pending, 'import');
      $('import-file-name').textContent = file.name;
      $('import-exported-at').textContent = new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(backup.exportedAt));
      $('backup-preview').hidden = false;
      status('Sicherung geprüft. Du kannst die Daten jetzt importieren.');
      $('backup-restore').focus({ preventScroll: true });
    } catch (error) { status(error.message || 'Die Datei konnte nicht gelesen werden.', true); }
    finally { $('backup-choose').disabled = false; $('backup-file').value = ''; }
  });
  $('backup-cancel').addEventListener('click', () => { clearPending(); status('Import verworfen.'); $('backup-choose').focus(); });
  $('backup-restore').addEventListener('click', () => {
    if (!pending) return;
    try {
      onImport(pending);
      clearPending(); summary(getState(), 'export');
      status('Die Anwesenheitsdaten wurden importiert und auf diesem Gerät gespeichert.');
      $('backup-choose').focus();
    } catch {
      status('Import nicht gespeichert. Prüfe den verfügbaren Browserspeicher. Die bisherigen Daten bleiben erhalten.', true);
    }
  });
}
