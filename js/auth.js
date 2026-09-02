/* =========================================================
   RestoApp - Sistema de Reservas de Restaurante
   js/auth.js  ->  LOGIN y permisos por rol
   - Hash de contrasenas con SHA-256 (WebCrypto) + sal
   - Sesion y control de acceso por rol
   Expone el objeto global: window.Auth
   ========================================================= */
window.Auth = (() => {
  const ROLES = {
    admin: { label: 'Administrador', dashboard: 'dashboard' },
    mesero: { label: 'Mesero', dashboard: 'mesas' },
    cocina: { label: 'Cocina', dashboard: 'cocina' },
    despacho: { label: 'Despacho', dashboard: 'despacho' }
  };

  // Permisos: vistas accesibles por cada rol
  const PERMS = {
    admin: ['dashboard', 'mesas', 'reservas', 'pedidos', 'cocina', 'despacho', 'usuarios'],
    mesero: ['mesas', 'reservas', 'pedidos', 'despacho'],
    cocina: ['cocina'],
    despacho: ['despacho']
  };

  // Hash SHA-256 asíncrono con Web Crypto
  async function sha256(text) {
    const data = new TextEncoder().encode(text);
    const buf = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Genera sal aleatoria y devuelve { hash, salt }
  async function hashPassword(password, salt) {
    const s = salt || generateSalt();
    const hash = await sha256(s + '|' + password);
    return { hash, salt: s };
  }

  function generateSalt() {
    const arr = new Uint8Array(16);
    crypto.getRandomValues(arr);
    return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Inicializa los hashes de los usuarios demo (una sola vez)
  async function ensureDemoHashes() {
    const users = Storage.getCollection('users');
    let changed = false;
    const defaultPass = {
      admin: 'admin123',
      mesero: 'mesero123',
      cocina: 'cocina123',
      despacho: 'despacho123'
    };
    for (const u of users) {
      if (defaultPass[u.role] == null) continue;
      const tieneHash = !!(u.passHash && u.salt);
      // Si tiene hash, comprueba que corresponde a la contraseña demo actual.
      // Si un hash quedó guardado de una versión anterior del algoritmo, se regenera.
      const valido = tieneHash && (await hashPassword(defaultPass[u.role], u.salt)).hash === u.passHash;
      if (!valido) {
        const { hash, salt } = await hashPassword(defaultPass[u.role], null);
        u.passHash = hash;
        u.salt = salt;
        changed = true;
      }
    }
    if (changed) Storage.saveCollection('users', users);
  }

  // Intento de login. Devuelve objeto de sesión o lanza error.
  async function login(username, password) {
    const uname = (username || '').trim().toLowerCase();
    const pwd = String(password || '');
    if (!uname || !pwd) throw new Error('Ingresa usuario y contraseña.');
    if (pwd.length > 64) throw new Error('Contraseña demasiado larga.');

    const users = Storage.getCollection('users');
    const user = users.find((u) => String(u.username).toLowerCase() === uname);

    // Los hashes deben existir: asegura que los demo estén listos
    if (!user || !user.passHash || !user.salt) {
      throw new Error('Usuario o contraseña incorrectos.');
    }

    const hash = await sha256(user.salt + '|' + pwd);
    if (hash !== user.passHash) {
      throw new Error('Usuario o contraseña incorrectos.');
    }

    return Storage.saveSession({
      username: user.username,
      role: user.role,
      name: user.name
    });
  }

  function currentUser() {
    return Storage.getSession();
  }

  function isLoggedIn() {
    const s = Storage.getSession();
    return !!(s && ROLES[s.role]);
  }

  function hasAccess(view) {
    const s = Storage.getSession();
    if (!s) return false;
    const perms = PERMS[s.role];
    return Array.isArray(perms) && perms.includes(view);
  }

  function roleLabel(role) {
    return (ROLES[role] && ROLES[role].label) || role;
  }

  function getAllRoles() {
    return Object.keys(ROLES);
  }

  function canManageUsers() {
    return hasAccess('usuarios');
  }

  function logout() {
    Storage.clearSession();
  }

  return {
    login,
    currentUser,
    isLoggedIn,
    hasAccess,
    roleLabel,
    getAllRoles,
    canManageUsers,
    ensureDemoHashes,
    hashPassword,
    logout,
    perms: PERMS
  };
})();
