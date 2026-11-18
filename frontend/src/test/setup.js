import "@testing-library/jest-dom/vitest";

const storedValues = new Map();
const localStorageShim = {
  getItem: (key) => storedValues.has(String(key)) ? storedValues.get(String(key)) : null,
  setItem: (key, value) => storedValues.set(String(key), String(value)),
  removeItem: (key) => storedValues.delete(String(key)),
  clear: () => storedValues.clear(),
};

Object.defineProperty(window, "localStorage", { configurable: true, value: localStorageShim });
Object.defineProperty(globalThis, "localStorage", { configurable: true, value: localStorageShim });
