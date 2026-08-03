const fs = require('fs');
const path = require('path');
const { app } = require('electron');
const { ConfigStore } = require('./store/config-store');
const { startServer } = require('./server/http-server');
const { attachWebSocketServer } = require('./server/ws-server');

/**
 * PortManager — owns every overlay port instance.
 *
 * Each port has:
 *   - Its own Express/HTTP server listening on a unique port
 *   - Its own WebSocket server (/overlay/socket on that HTTP server)
 *   - Its own ConfigStore (settings stored in userData/ports/<id>.json)
 *
 * All ports share a single CaptureManager and thus a single YouTube chat
 * connection.  New chat messages are broadcast to every port so every OBS
 * scene shows the same live chat stream.  Settings changes are sent only to
 * the currently selected port's WebSocket clients.
 */
class PortManager {
  /**
   * @param {() => object[]} getMessageHistory - returns the shared message history array
   */
  constructor(getMessageHistory) {
    /** @type {Map<string, PortEntry>} */
    this.ports = new Map();
    this.selectedPortId = null;
    this.getMessageHistory = getMessageHistory;
    this.registryPath = path.join(app.getPath('userData'), 'ports-registry.json');
  }

  // ── Registry (persists port list across restarts) ─────────────────────────

  _loadRegistry() {
    try {
      const raw = fs.readFileSync(this.registryPath, 'utf-8');
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return data;
    } catch { /* first run */ }
    return [];
  }

  _saveRegistry() {
    const data = Array.from(this.ports.values()).map(({ id, name, httpPort }) => ({
      id,
      name,
      preferredPort: httpPort,
    }));
    try {
      fs.mkdirSync(path.dirname(this.registryPath), { recursive: true });
      fs.writeFileSync(this.registryPath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (err) {
      console.error('[port-manager] failed to save registry:', err);
    }
  }

  // ── Per-port helpers ──────────────────────────────────────────────────────

  /** Build the getState callback that http-server and ws-server need. */
  _makeGetState(id) {
    return () => {
      const entry = this.ports.get(id);
      if (!entry) return {};
      const state = entry.configStore.get();
      return {
        themeId: state.selectedTheme,
        config: state.customizeConfig,
        layoutConfig: state.layoutConfig,
        slotStyleConfig: state.slotStyleConfig,
        animationConfig: state.animationConfig,
        decorationConfig: state.decorationConfig,
        roleStyleConfig: state.roleStyleConfig,
        fanServiceConfig: state.fanServiceConfig,
        history: this.getMessageHistory(),
      };
    };
  }

  /**
   * Start a single port: creates ConfigStore, HTTP server, WS server.
   * Returns the completed entry (also stored in this.ports).
   */
  async _startPort(id, name, preferredPort) {
    const configStore = new ConfigStore(id);
    const getState = this._makeGetState(id);

    // startServer auto-increments port on EADDRINUSE — maxAttempts=20
    const { server, port: httpPort } = await startServer(getState, preferredPort, 20);
    const { broadcast } = attachWebSocketServer(server, getState);

    /** @type {PortEntry} */
    const entry = { id, name, httpPort, server, broadcast, configStore };
    this.ports.set(id, entry);
    console.log(`[port-manager] port "${name}" (${id}) listening on :${httpPort}`);
    return entry;
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  /**
   * Initialize: load saved registry (or create the default port on first run),
   * start all port servers, select the first port.
   */
  async initialize() {
    const registry = this._loadRegistry();

    if (registry.length === 0) {
      // First run — create the single default port
      await this._startPort('default', 'Port 1', 3000);
      this.selectedPortId = 'default';
    } else {
      // Start each saved port, giving them their last-known port number as the
      // preferred value so they tend to land on the same port after a restart.
      for (const entry of registry) {
        await this._startPort(entry.id, entry.name, entry.preferredPort || 3000);
      }
      this.selectedPortId = registry[0].id;
    }

    this._saveRegistry();
    console.log(`[port-manager] initialized ${this.ports.size} port(s), selected: ${this.selectedPortId}`);
    return this.selectedPortId;
  }

  /** Serialisable list of all ports (safe to send over IPC). */
  list() {
    return Array.from(this.ports.values()).map(({ id, name, httpPort }) => ({
      id,
      name,
      httpPort,
      overlayUrl: `http://localhost:${httpPort}/overlay`,
      isSelected: id === this.selectedPortId,
    }));
  }

  /** The currently active port entry (the one the dashboard is editing). */
  getSelected() {
    return this.ports.get(this.selectedPortId);
  }

  /** Full overlay state for the selected port (used by IPC handlers). */
  getSelectedState() {
    const entry = this.getSelected();
    if (!entry) return null;
    return entry.configStore.get();
  }

  /** Switch which port the dashboard is currently editing.  Returns false if id unknown. */
  select(id) {
    if (!this.ports.has(id)) return false;
    this.selectedPortId = id;
    return true;
  }

  /**
   * Create a new port by cloning settings from `sourceId` (defaults to the
   * currently selected port).
   */
  async create(name, sourceId = null) {
    const src = sourceId ? this.ports.get(sourceId) : this.getSelected();

    // Find an unoccupied port: start just above the highest port in use
    const usedPorts = Array.from(this.ports.values()).map((p) => p.httpPort);
    const tryPort = Math.max(...usedPorts, 2999) + 1;

    const id = `port-${Date.now()}`;
    const entry = await this._startPort(id, name, tryPort);

    // Clone all settings from the source port
    if (src) {
      const srcState = src.configStore.get();
      entry.configStore.set({
        selectedTheme: srcState.selectedTheme,
        customizeConfig: srcState.customizeConfig,
        layoutConfig: srcState.layoutConfig,
        slotStyleConfig: srcState.slotStyleConfig,
        animationConfig: srcState.animationConfig,
        decorationConfig: srcState.decorationConfig,
        roleStyleConfig: srcState.roleStyleConfig,
        fanServiceConfig: srcState.fanServiceConfig,
      });
    }

    this._saveRegistry();
    return {
      id,
      name,
      httpPort: entry.httpPort,
      overlayUrl: `http://localhost:${entry.httpPort}/overlay`,
    };
  }

  /**
   * Remove a port.  The first port in the list cannot be removed (minimum
   * of one port must always exist).
   */
  async remove(id) {
    if (this.ports.size <= 1) {
      return { ok: false, error: 'cannot_remove_last_port' };
    }

    const entry = this.ports.get(id);
    if (!entry) return { ok: false, error: 'port_not_found' };

    // Prevent deleting the first port (index 0 in insertion order)
    const ids = Array.from(this.ports.keys());
    if (ids[0] === id) {
      return { ok: false, error: 'cannot_remove_first_port' };
    }

    // Close the HTTP server (which also closes the WS server)
    await new Promise((resolve) => entry.server.close(() => resolve()));
    // Delete the backing config file
    entry.configStore.deleteFile();

    this.ports.delete(id);

    // If the deleted port was selected, fall back to the first available port
    if (this.selectedPortId === id) {
      this.selectedPortId = this.ports.keys().next().value;
    }

    this._saveRegistry();
    return { ok: true, newSelectedId: this.selectedPortId };
  }

  /** Rename a port. */
  rename(id, name) {
    const entry = this.ports.get(id);
    if (!entry) return { ok: false, error: 'port_not_found' };
    entry.name = name;
    this._saveRegistry();
    return { ok: true };
  }

  /** Broadcast a message to ALL port WS clients (e.g. new chat message). */
  broadcastAll(type, data) {
    this.ports.forEach(({ broadcast }) => broadcast(type, data));
  }

  /** Broadcast only to the currently selected port's WS clients (e.g. config update). */
  broadcastSelected(type, data) {
    this.getSelected()?.broadcast(type, data);
  }
}

module.exports = { PortManager };
