// Almacenamiento local en IndexedDB (soporta fotos y firmas sin el límite de 5 MB de localStorage).

const DB = (() => {
  const NAME = 'control-operacional';
  const STORE = 'registros';
  let dbPromise;

  function open() {
    if (!dbPromise) {
      dbPromise = new Promise((resolve, reject) => {
        const req = indexedDB.open(NAME, 1);
        req.onupgradeneeded = () => {
          const store = req.result.createObjectStore(STORE, { keyPath: 'id' });
          store.createIndex('tipo', 'tipo');
          store.createIndex('fecha', 'fecha');
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
      });
    }
    return dbPromise;
  }

  async function tx(mode, fn) {
    const db = await open();
    return new Promise((resolve, reject) => {
      const t = db.transaction(STORE, mode);
      const result = fn(t.objectStore(STORE));
      t.oncomplete = () => resolve(result && 'result' in result ? result.result : undefined);
      t.onerror = () => reject(t.error);
    });
  }

  return {
    put: (rec) => tx('readwrite', (s) => s.put(rec)),
    get: (id) => tx('readonly', (s) => s.get(id)),
    remove: (id) => tx('readwrite', (s) => s.delete(id)),
    all: async () => {
      const list = await tx('readonly', (s) => s.getAll());
      return list.sort((a, b) => b.fecha.localeCompare(a.fecha));
    },
    clear: () => tx('readwrite', (s) => s.clear()),
  };
})();

const Settings = {
  KEY: 'cop_settings',
  defaults: { endpoint: '', token: '', inspector: '', rut: '', empresa: '' },
  load() {
    try {
      return { ...this.defaults, ...JSON.parse(localStorage.getItem(this.KEY) || '{}') };
    } catch {
      return { ...this.defaults };
    }
  },
  save(values) {
    localStorage.setItem(this.KEY, JSON.stringify(values));
  },
};
