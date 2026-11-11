export class HttpError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function requirePositiveNumber(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) throw new HttpError(400, `${fieldName} must be greater than zero`);
  return number;
}

export function requireNonNegativeNumber(value, fieldName) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) throw new HttpError(400, `${fieldName} must be zero or greater`);
  return number;
}

export function moneyToCents(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) throw new HttpError(400, 'Invalid money value');
  return Math.round(number * 100);
}

export function centsToMoney(cents) {
  return (cents / 100).toFixed(2);
}

export function generateNumber(prefix) {
  const date = new Date().toISOString().slice(0, 10).replaceAll('-', '');
  return `${prefix}-${date}-${Date.now().toString().slice(-8)}`;
}
