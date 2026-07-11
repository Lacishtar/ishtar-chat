const fs = require('fs');
const path = require('path');
const { app } = require('electron');

const CONFIG_CATEGORIES = [
  'customizeConfig',
  'layoutConfig',
  'slotStyleConfig',
  'animationConfig',
  'decorationConfig',
  'roleStyleConfig',
];

function createPresetId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `cp-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
}

/**
 * Validates a parsed import payload and returns the set of valid preset
 * objects together with any per-entry error strings.
 *
 * @param {unknown} parsed
 * @returns {{ valid: boolean, errors: string[], presets: object[] }}
 */
function validateImportedPresets(parsed) {
  if (!parsed || typeof parsed !== 'object') {
    return { valid: false, errors: ['Định dạng JSON không hợp lệ.'], presets: [] };
  }

  const rawPresets = parsed.presets;
  if (!Array.isArray(rawPresets)) {
    return { valid: false, errors: ['Thiếu trường "presets" (mảng).'], presets: [] };
  }

  const errors = [];
  const validPresets = [];

  for (let i = 0; i < rawPresets.length; i++) {
    const p = rawPresets[i];

    if (!p || typeof p !== 'object') {
      errors.push(`Preset #${i + 1}: không phải object.`);
      continue;
    }

    if (!p.name || typeof p.name !== 'string') {
      errors.push(`Preset #${i + 1}: thiếu hoặc sai trường "name".`);
      continue;
    }

    const missingCats = CONFIG_CATEGORIES.filter((c) => !p[c] || typeof p[c] !== 'object');
    if (missingCats.length > 0) {
      errors.push(`Preset "${p.name}": thiếu danh mục: ${missingCats.join(', ')}.`);
      continue;
    }

    validPresets.push(p);
  }

  return { valid: validPresets.length > 0, errors, presets: validPresets };
}

/**
 * CustomPresetsStore — stores user-defined appearance presets in
 * `userData/custom-presets.json`, independent of the theme system.
 *
 * Public surface mirrors ConfigStore's minimal contract so callers are
 * consistent: no external state is mutated; the store owns its own file.
 */
class CustomPresetsStore {
  constructor() {
    this.filePath = path.join(app.getPath('userData'), 'custom-presets.json');
    this._presets = this._load();
    this._saveTimer = null;
  }

  // ── Private ──────────────────────────────────────────────────────────────

  _load() {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf-8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.presets)) return parsed.presets;
    } catch (_err) {
      // first run — no file yet, or parse error → start fresh
    }
    return [];
  }

  _flush() {
    try {
      fs.mkdirSync(path.dirname(this.filePath), { recursive: true });
      fs.writeFileSync(
        this.filePath,
        JSON.stringify({ version: 1, presets: this._presets }, null, 2),
        'utf-8',
      );
    } catch (err) {
      console.error('[custom-presets-store] failed to write custom-presets.json:', err);
    }
  }

  _scheduleFlush() {
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(() => this._flush(), 300);
  }

  // ── Public ───────────────────────────────────────────────────────────────

  /** Returns lightweight metadata for every stored preset (no config blobs). */
  list() {
    return this._presets.map(({ id, name, createdAt, updatedAt }) => ({
      id,
      name,
      createdAt,
      updatedAt,
    }));
  }

  /** Returns the full preset object including all config categories, or null. */
  get(id) {
    return this._presets.find((p) => p.id === id) || null;
  }

  /**
   * Creates a new preset with `name` or overwrites an existing one if the
   * name already exists (case-sensitive). Returns the updated metadata list.
   *
   * @param {string} name
   * @param {object} snapshot — must contain all six CONFIG_CATEGORIES keys
   * @returns {object[]} updated metadata list
   */
  save(name, snapshot) {
    const existing = this._presets.find((p) => p.name === name);
    const now = new Date().toISOString();

    if (existing) {
      CONFIG_CATEGORIES.forEach((cat) => {
        existing[cat] = snapshot[cat];
      });
      existing.updatedAt = now;
    } else {
      this._presets.push({
        id: createPresetId(),
        name,
        createdAt: now,
        updatedAt: now,
        ...Object.fromEntries(CONFIG_CATEGORIES.map((c) => [c, snapshot[c]])),
      });
    }

    this._scheduleFlush();
    return this.list();
  }

  /**
   * Renames an existing preset by id.
   *
   * @param {string} id
   * @param {string} newName
   * @returns {{ ok: boolean, error?: string }}
   */
  rename(id, newName) {
    const preset = this._presets.find((p) => p.id === id);
    if (!preset) return { ok: false, error: 'preset_not_found' };
    preset.name = newName;
    preset.updatedAt = new Date().toISOString();
    this._scheduleFlush();
    return { ok: true };
  }

  /**
   * Deletes a preset by id.
   *
   * @param {string} id
   * @returns {{ ok: boolean, error?: string }}
   */
  delete(id) {
    const idx = this._presets.findIndex((p) => p.id === id);
    if (idx === -1) return { ok: false, error: 'preset_not_found' };
    this._presets.splice(idx, 1);
    this._scheduleFlush();
    return { ok: true };
  }

  /**
   * Merges an array of validated preset objects into the store.
   * Presets whose `name` already exists are overwritten; the rest are added.
   *
   * @param {object[]} incoming — already validated by validateImportedPresets
   * @returns {{ added: number, overwritten: number }}
   */
  importPresets(incoming) {
    const now = new Date().toISOString();
    let added = 0;
    let overwritten = 0;

    for (const p of incoming) {
      const existing = this._presets.find((e) => e.name === p.name);
      if (existing) {
        CONFIG_CATEGORIES.forEach((cat) => {
          existing[cat] = p[cat];
        });
        existing.updatedAt = now;
        overwritten++;
      } else {
        this._presets.push({
          id: createPresetId(),
          name: p.name,
          createdAt: now,
          updatedAt: now,
          ...Object.fromEntries(CONFIG_CATEGORIES.map((c) => [c, p[c]])),
        });
        added++;
      }
    }

    this._scheduleFlush();
    return { added, overwritten };
  }

  /** Returns the full preset array including config blobs, for JSON export. */
  exportAll() {
    return this._presets;
  }
}

module.exports = { CustomPresetsStore, validateImportedPresets };
