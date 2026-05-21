const STORAGE_KEY = 'sempilot-data';

export const LocalStorageAdapter = {
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.error('Load failed:', err);
      return null;
    }
  },

  save(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (err) {
      console.error('Save failed:', err);
    }
  },

  clear() {
    localStorage.removeItem(STORAGE_KEY);
  },
};