/* =========================================================
   RestoApp - Sistema de Reservas de Restaurante
   js/storage.js  ->  PERSISTENCIA en localStorage
   - Lectura validada/saneada (anti-corrupcion / anti-inyeccion)
   - Escape para render seguro (anti-XSS)
   Expone el objeto global: window.Storage
   ========================================================= */
window.Storage = (() => {
  const PREFIX = 'restoapp_';
  const DB_KEY = PREFIX + 'db_v1';
  const SESSION_KEY = PREFIX + 'session';

  // Claves internas de los datos (no sensibles)
  const KEYS = ['users', 'mesas', 'platos', 'reservas', 'pedidos', 'despachos'];

  // Sanitiza una cadena: elimina HTML peligroso y recorta tamaño
  function sanitizeString(value, maxLen = 200) {
    if (typeof value !== 'string') return '';
    let s = value.replace(/[<>]/g, (m) => (m === '<' ? '\u2039' : '\u203a'));
    s = s.replace(/[`"]/g, '\u0027');
    s = s.slice(0, maxLen);
    return s.trim();
  }

  // Saneo de un arreglo de texto
  function sanitizeList(list, max = 40) {
    if (!Array.isArray(list)) return [];
    return list.map((x) => sanitizeString(x)).filter((x) => x).slice(0, max);
  }

  // Escapa para render seguro (evita XSS)
  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  // Retorna la estructura por defecto (datos demo)
  function defaultDB() {
    return {
      users: [
        { username: 'admin', passHash: null, salt: null, role: 'admin', name: 'Administrador' },
        { username: 'mesero', passHash: null, salt: null, role: 'mesero', name: 'Mesero Demo' },
        { username: 'cocina', passHash: null, salt: null, role: 'cocina', name: 'Cocina Demo' },
        { username: 'despacho', passHash: null, salt: null, role: 'despacho', name: 'Despacho Demo' }
      ],
      mesas: [
        { id: 1, nombre: 'Mesa 1', capacidad: 2, estado: 'disponible' },
        { id: 2, nombre: 'Mesa 2', capacidad: 4, estado: 'disponible' },
        { id: 3, nombre: 'Mesa 3', capacidad: 4, estado: 'disponible' },
        { id: 4, nombre: 'Mesa 4', capacidad: 6, estado: 'disponible' },
        { id: 5, nombre: 'Mesa 5', capacidad: 2, estado: 'disponible' },
        { id: 6, nombre: 'Mesa 6', capacidad: 4, estado: 'disponible' },
        { id: 7, nombre: 'Mesa 7', capacidad: 8, estado: 'disponible' },
        { id: 8, nombre: 'Mesa 8', capacidad: 4, estado: 'disponible' }
      ],
      platos: [
        { id: 1, nombre: 'Ceviche Mixto', precio: 28000, tipo: 'entrada' },
        { id: 2, nombre: 'Lomo Saltado', precio: 32000, tipo: 'fondo' },
        { id: 3, nombre: 'Ají de Gallina', precio: 26000, tipo: 'fondo' },
        { id: 4, nombre: 'Arroz con Mariscos', precio: 34000, tipo: 'fondo' },
        { id: 5, nombre: 'Causa Limeña', precio: 24000, tipo: 'entrada' },
        { id: 6, nombre: 'Pollo a la Brasa', precio: 30000, tipo: 'fondo' },
        { id: 7, nombre: 'Picante de Mariscos', precio: 35000, tipo: 'fondo' },
        { id: 8, nombre: 'Suspiro a la Limeña', precio: 15000, tipo: 'postre' }
      ],
      reservas: [],
      pedidos: [],
      despachos: []
    };
  }

  // Carga el arreglo de cada clave con validación estricta de tipos
  function getCollection(key) {
    const db = loadAll();
    const list = Array.isArray(db[key]) ? db[key] : [];
    return list.filter((item) => item && typeof item === 'object');
  }

  // Guarda una colección validando forma básica
  function saveCollection(key, list) {
    const db = loadAll();
    db[key] = Array.isArray(list) ? list : [];
    persist(db);
  }

  function loadAll() {
    try {
      const raw = localStorage.getItem(DB_KEY);
      if (!raw) return defaultDB();
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== 'object') return defaultDB();
      const db = defaultDB();
      // Solo copia las claves conocidas, ignorando datos extra
      KEYS.forEach((k) => {
        if (Array.isArray(parsed[k])) db[k] = parsed[k];
      });
      return db;
    } catch (e) {
      // Datos corruptos -> volver a estado seguro por defecto
      return defaultDB();
    }
  }

  function persist(db) {
    try {
      localStorage.setItem(DB_KEY, JSON.stringify(db));
    } catch (e) {
      alert('No se pudo guardar. Espacio de almacenamiento lleno.');
    }
  }

  function resetAll() {
    localStorage.removeItem(DB_KEY);
    localStorage.removeItem(SESSION_KEY);
  }

  // Sesión actual
  function saveSession(user) {
    // Guarda datos no sensibles de la sesión
    const session = {
      username: typeof user.username === 'string' ? user.username : '',
      role: typeof user.role === 'string' ? user.role : '',
      name: typeof user.name === 'string' ? user.name : '',
      loginAt: Date.now(),
      token: buildSessionToken(user && user.username ? user.username : '')
    };
    try {
      localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    } catch (e) { /* ignore */ }
    return session;
  }

  // Token de sesión simple (no crítico: es una demo local)
  function buildSessionToken(username) {
    let h = 0;
    const s = String(username || '') + '-' + String(Date.now() % 100000);
    for (let i = 0; i < s.length; i++) {
      h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
    }
    const rnd = Math.floor(Math.random() * 1000000);
    return (h >>> 0).toString(16) + '-' + rnd.toString(16);
  }

  function getSession() {
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const s = JSON.parse(raw);
      if (!s || typeof s.username !== 'string' || !s.username) return null;
      return s;
    } catch (e) {
      return null;
    }
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  return {
    sanitizeString,
    sanitizeList,
    escapeHtml,
    getCollection,
    saveCollection,
    loadAll,
    resetAll,
    saveSession,
    getSession,
    clearSession,
    dbKey: DB_KEY
  };
})();
