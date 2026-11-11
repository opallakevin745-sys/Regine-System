const configuredApiUrl = import.meta.env.VITE_API_URL?.replace(/\/+$/, '');
const API_URL = configuredApiUrl
  ? configuredApiUrl.endsWith('/api') ? configuredApiUrl : `${configuredApiUrl}/api`
  : '/api';

let unauthorizedHandler = () => {};

export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

export function onDataChanged(areas, handler) {
  const handleAreas = (changedAreas) => {
    if (changedAreas.some((area) => areas.includes(area))) handler(changedAreas);
  };
  const listener = (event) => handleAreas(event.detail.areas);
  const storageListener = (event) => {
    if (event.key !== 'mutya_data_changed' || !event.newValue) return;
    try { handleAreas(JSON.parse(event.newValue).areas || []); } catch {}
  };
  window.addEventListener('business-data-changed', listener);
  window.addEventListener('storage', storageListener);
  return () => {
    window.removeEventListener('business-data-changed', listener);
    window.removeEventListener('storage', storageListener);
  };
}

function notifyDataChanged(method, path) {
  const normalizedPath = path.split('?')[0].replace(/\/$/, '');
  let areas = [];
  if (method === 'POST' && normalizedPath === '/stock-receiving') {
    areas = ['receiving', 'inventory', 'products', 'dashboard', 'inventory-history', 'reports'];
  } else if (method === 'POST' && normalizedPath === '/sales' || method === 'PATCH' && /\/sales\/\d+\/cancel$/.test(normalizedPath)) {
    areas = ['sales', 'payments', 'inventory', 'products', 'dashboard', 'inventory-history', 'reports'];
  } else if (method === 'POST' && normalizedPath === '/inventory/adjustments') {
    areas = ['inventory', 'products', 'dashboard', 'inventory-history', 'reports'];
  }
  if (areas.length) {
    const change = { areas, occurredAt: Date.now() };
    window.dispatchEvent(new CustomEvent('business-data-changed', { detail: change }));
    try { localStorage.setItem('mutya_data_changed', JSON.stringify(change)); } catch {}
  }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiRequest(path, options = {}) {
  const token = localStorage.getItem('mutya_token');
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const body = await response.json().catch(() => ({}));
  if (response.status === 401) {
    localStorage.removeItem('mutya_token');
    unauthorizedHandler();
  }
  if (!response.ok) throw new ApiError(body.message || 'Request failed', response.status);
  notifyDataChanged((options.method || 'GET').toUpperCase(), path);
  return body;
}
