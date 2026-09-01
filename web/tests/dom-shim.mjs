// Just enough of a browser for the store, models and wire to load under
// `node --test`. Not a DOM — views are exercised by tools/smoke.mjs instead.
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
  key: (i) => [...store.keys()][i] ?? null,
  get length() { return store.size; },
};
// prefs.clearAll iterates Object.keys(localStorage) — expose stored keys as own props.
globalThis.localStorage = new Proxy(globalThis.localStorage, {
  ownKeys: (t) => [...new Set([...Reflect.ownKeys(t), ...store.keys()])],
  getOwnPropertyDescriptor: (t, k) => (store.has(k) ? { enumerable: true, configurable: true, value: store.get(k) } : Reflect.getOwnPropertyDescriptor(t, k)),
});
globalThis.sessionStorage = { getItem: () => null, setItem() {}, removeItem() {} };
globalThis.window = globalThis;
globalThis.self = globalThis;
globalThis.location = { search: "", protocol: "http:", hostname: "127.0.0.1" };
globalThis.addEventListener = () => {};
globalThis.removeEventListener = () => {};
globalThis.dispatchEvent = () => true;
globalThis.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} });
globalThis.requestAnimationFrame = (fn) => setTimeout(() => fn(performance.now()), 16);
globalThis.cancelAnimationFrame = (id) => clearTimeout(id);
globalThis.requestIdleCallback = (fn) => setTimeout(fn, 0);
globalThis.document = { documentElement: { dataset: {} }, visibilityState: "visible", addEventListener() {}, removeEventListener() {}, head: { appendChild() {} }, getElementById: () => null, createElement: () => ({ style: {}, setAttribute() {}, appendChild() {} }) };
globalThis.navigator ??= {};
if (typeof globalThis.Notification === "undefined") globalThis.Notification = undefined;
