const pesoFormatter = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const compactFormatter = new Intl.NumberFormat('en-PH', { notation: 'compact', maximumFractionDigits: 1 });

export const money = (value) => pesoFormatter.format(Number(value || 0));
export const compactMoney = (value) => `₱${compactFormatter.format(Number(value || 0))}`;
export const qty = (value) => Number(value || 0).toLocaleString('en-PH', { maximumFractionDigits: 3 });
export const count = (value) => Number(value || 0).toLocaleString('en-PH');

const pad = (value) => String(value).padStart(2, '0');

// DATE columns arrive as YYYY-MM-DD; parse them as local dates so they never shift a day.
function toDate(value) {
  if (!value) return null;
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return new Date(`${value}T00:00:00`);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDate(value) {
  const date = toDate(value);
  return date ? date.toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';
}

export function formatDateTime(value) {
  const date = toDate(value);
  return date ? date.toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
}

export function formatTime(value) {
  const date = toDate(value);
  return date ? date.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' }) : '—';
}

export function inputDate(date = new Date()) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return inputDate(date);
}

export const statusSlug = (status) => String(status || '').toLowerCase().replaceAll(' ', '-').replaceAll('_', '-');
export const titleCase = (value) => String(value || '').toLowerCase().replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
export const isDecimalUnit = (unit) => ['kg', 'kilo', 'kilogram', 'g', 'liter', 'l'].includes(String(unit || '').toLowerCase());
export const plural = (value, word, plural = `${word}s`) => `${count(value)} ${Number(value) === 1 ? word : plural}`;
