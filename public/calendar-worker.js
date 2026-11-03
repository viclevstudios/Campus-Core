import { parseCalendar } from './core.js';
self.onmessage = ({ data }) => {
  try { self.postMessage({ result: parseCalendar(data) }); }
  catch (error) { self.postMessage({ error: error.message || 'Der Kalender konnte nicht gelesen werden.' }); }
};
