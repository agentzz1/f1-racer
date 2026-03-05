export function getNumber(key, fallback = 0) {
  const v = localStorage.getItem(key);
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export function setNumber(key, value) {
  localStorage.setItem(key, String(Number(value)));
}

export function getString(key, fallback = '') {
  const v = localStorage.getItem(key);
  return v === null ? fallback : v;
}

export function setString(key, value) {
  localStorage.setItem(key, String(value));
}
