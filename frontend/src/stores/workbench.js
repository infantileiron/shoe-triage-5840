const data = new Map();

export function save(key, value) {
  data.set(key, value);
  return value;
}

export function load(key) {
  return data.get(key);
}

export function reset() {
  data.clear();
}
