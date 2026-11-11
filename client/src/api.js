const configuredApiUrl = import.meta.env.VITE_API_URL?.replace(/\/+$/, '');
const API_URL = configuredApiUrl
  ? configuredApiUrl.endsWith('/api') ? configuredApiUrl : `${configuredApiUrl}/api`
  : '/api';

// Demo builds (GitHub Pages) answer API calls in the browser instead of calling the Express server.
export const isDemo = import.meta.env.VITE_DEMO_MODE === 'true';

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
    try { handleAreas(JSON.parse(event.newValue).areas || []); } catch { /* ignore malformed events */ }
  };
  window.addEventListener('business-data-changed', listener);
  window.addEventListener('storage', storageListener);
  return () => {
    window.removeEventListener('business-data-changed', listener);
    window.removeEventListener('storage', storageListener);
  };
}

const changeAreas = [
  [/^POST \/stock-receiving$/, ['receiving', 'inventory', 'products', 'dashboard', 'inventory-history', 'reports']],
  [/^(POST \/sales|PATCH \/sales\/\d+\/cancel)$/, ['sales', 'payments', 'inventory', 'products', 'dashboard', 'inventory-history', 'reports']],
  [/^POST \/inventory\/adjustments$/, ['inventory', 'products', 'dashboard', 'inventory-history', 'reports']],
  [/^(POST|PUT|PATCH) \/products/, ['products', 'inventory', 'dashboard', 'reports']],
  [/^(POST|PUT|PATCH) \/categories/, ['categories', 'products', 'reports']],
  [/^(POST|PUT|PATCH) \/suppliers/, ['suppliers', 'reports']],
  [/^(POST|PUT|PATCH) \/employees/, ['employees', 'users', 'dashboard']],
  [/^(POST|PUT|PATCH) \/users/, ['users', 'employees']]
];

export function notifyDataChanged(areas) {
  const change = { areas, occurredAt: Date.now() };
  window.dispatchEvent(new CustomEvent('business-data-changed', { detail: change }));
  try { localStorage.setItem('mutya_data_changed', JSON.stringify(change)); } catch { /* storage unavailable */ }
}

function notifyForRequest(method, path) {
  const key = `${method} ${path.split('?')[0].replace(/\/$/, '')}`;
  const match = changeAreas.find(([pattern]) => pattern.test(key));
  if (match) notifyDataChanged(match[1]);
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function send(path, options, method, token) {
  if (isDemo) {
    const { handleDemoRequest } = await import('./demo/demoServer.js');
    return handleDemoRequest({ method, path, token, body: options.body ? JSON.parse(options.body) : undefined });
  }
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...options,
      method,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers
      }
    });
  } catch {
    throw new ApiError('Cannot reach the server. Check your connection and that the API is running.', 0);
  }
  return { status: response.status, body: await response.json().catch(() => ({})) };
}

export async function apiRequest(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase();
  const token = localStorage.getItem('mutya_token');
  const { status, body } = await send(path, options, method, token);
  if (status === 401 && path !== '/auth/login') {
    localStorage.removeItem('mutya_token');
    unauthorizedHandler();
  }
  if (status < 200 || status >= 300) throw new ApiError(body.message || 'Request failed', status);
  if (method !== 'GET') notifyForRequest(method, path);
  return body;
}

export function buildQuery(params) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') query.set(key, value);
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}
