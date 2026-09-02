/* =========================================================
   RestoApp - Sistema de Reservas de Restaurante
   js/modules.js  ->  LOGICA de negocio y modelos de datos
   - Mesas, Reservas, Pedidos, Cocina, Despachos, Estadisticas
   - Validaciones de negocio y CRUD de usuarios
   Expone el objeto global: window.Modules
   ========================================================= */
window.Modules = (() => {
  // ---------- Utilidades de dominio ----------
  function todayStr() {
    const d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function pad(n) {
    return String(n).padStart(2, '0');
  }

  function nextId(list, prefix) {
    let max = 0;
    list.forEach((it) => {
      if (it && typeof it.id === 'number' && it.id > max) max = it.id;
    });
    return max + 1;
  }

  // ---------- Mesas ----------
  function getMesas() {
    return Storage.getCollection('mesas');
  }

  function getMesa(mesaId) {
    return getMesas().find((m) => m.id === Number(mesaId)) || null;
  }

  // Recalcula estado de cada mesa según reservas/pedidos
  function syncMesaEstados() {
    const mesas = getMesas();
    const reservas = getReservas();
    const pedidos = getPedidos();
    const today = todayStr();

    mesas.forEach((mesa) => {
      // Ocupada si tiene un pedido activo (no terminado)
      const tienePedidoActivo = pedidos.some(
        (p) => p.mesaId === mesa.id && !['entregado', 'cancelado'].includes(p.estado)
      );
      // Reservada si tiene reserva confirmada de hoy
      const tieneReservaHoy = reservas.some(
        (r) => r.mesaId === mesa.id && r.fecha === today && r.estado === 'confirmada'
      );
      if (tienePedidoActivo) {
        mesa.estado = 'ocupada';
      } else if (tieneReservaHoy) {
        mesa.estado = 'reservada';
      } else {
        mesa.estado = 'disponible';
      }
    });
    Storage.saveCollection('mesas', mesas);
  }

  // ---------- Reservas ----------
  function getReservas() {
    return Storage.getCollection('reservas');
  }

  function crearReserva(data) {
    const reservas = getReservas();
    const reserva = {
      id: nextId(reservas, 'reserva'),
      mesaId: Number(data.mesaId),
      nombreCliente: Storage.sanitizeString(data.nombreCliente, 80),
      telefono: Storage.sanitizeString(data.telefono, 20),
      fecha: Storage.sanitizeString(data.fecha, 10),
      hora: Storage.sanitizeString(data.hora, 5),
      personas: Math.min(50, Math.max(1, parseInt(data.personas, 10) || 1)),
      estado: 'confirmada',
      creadoPor: Storage.sanitizeString(data.creadoPor, 50),
      createdAt: Date.now()
    };
    if (!reserva.nombreCliente || !reserva.fecha || !reserva.hora) {
      throw new Error('Completa nombre, fecha y hora.');
    }
    // La mesa debe existir y tener capacidad suficiente
    const mesa = getMesa(reserva.mesaId);
    if (!mesa) throw new Error('Selecciona una mesa válida.');
    if (reserva.personas > mesa.capacidad) {
      throw new Error('Demasiadas personas para la capacidad de la mesa.');
    }
    // Validar fecha no pasada
    if (reserva.fecha < todayStr()) throw new Error('La fecha no puede ser anterior a hoy.');

    reserva.estado = reserva.fecha === todayStr() ? 'confirmada' : 'confirmada';
    reservas.push(reserva);
    Storage.saveCollection('reservas', reservas);
    syncMesaEstados();
    return reserva;
  }

  function cancelarReserva(id) {
    const reservas = getReservas();
    const r = reservas.find((x) => x.id === Number(id));
    if (r) {
      r.estado = 'cancelada';
      Storage.saveCollection('reservas', reservas);
      syncMesaEstados();
    }
  }

  // ---------- Pedidos ----------
  function getPedidos() {
    return Storage.getCollection('pedidos');
  }

  // Platos del pedido: [{ platoId, nombre, cantidad, precio, estado }]
  function crearPedido(data) {
    const pedidos = getPedidos();
    // Validación estricta de platos
    const items = Array.isArray(data.items) ? data.items : [];
    const platosValidados = [];
    for (const it of items) {
      const cantidad = Math.min(50, Math.max(1, parseInt(it.cantidad, 10) || 1));
      const platoId = Number(it.platoId);
      const plato = Storage.getCollection('platos').find((p) => p.id === platoId);
      if (!plato) continue; // descarta platos no válidos
      platosValidados.push({
        platoId,
        nombre: String(plato.nombre),
        precio: Number(plato.precio) || 0,
        cantidad,
        estado: 'pendiente' // pendiente -> preparacion -> listo
      });
    }
    if (!platosValidados.length) throw new Error('Agrega al menos un plato válido.');

    const mesa = getMesa(data.mesaId);
    if (!mesa) throw new Error('Selecciona una mesa válida.');

    const pedido = {
      id: nextId(pedidos, 'pedido'),
      mesaId: mesa.id,
      mesaNombre: String(mesa.nombre),
      items: platosValidados,
      estado: 'abierto', // abierto -> cerrado
      creadoPor: Storage.sanitizeString(data.creadoPor, 50),
      total: platosValidados.reduce((acc, i) => acc + i.precio * i.cantidad, 0),
      createdAt: Date.now()
    };
    pedidos.push(pedido);
    Storage.saveCollection('pedidos', pedidos);
    syncMesaEstados();
    return pedido;
  }

  function marcarPlato(pedidoId, platoId, estado) {
    const pedidos = getPedidos();
    const p = pedidos.find((x) => x.id === Number(pedidoId));
    if (!p) return;
    const item = p.items.find((i) => i.platoId === Number(platoId));
    if (!item) return;
    const estadosPermitidos = ['pendiente', 'preparacion', 'listo'];
    if (estadosPermitidos.includes(estado)) item.estado = estado;
    Storage.saveCollection('pedidos', pedidos);
    syncMesaEstados();
  }

  // Cierra un pedido cuando todos sus platos están listos
  function cerrarPedido(pedidoId) {
    const pedidos = getPedidos();
    const p = pedidos.find((x) => x.id === Number(pedidoId));
    if (!p) return;
    const todosListos = p.items.every((i) => i.estado === 'listo');
    if (!todosListos) throw new Error('Todos los platos deben estar en estado "listo".');
    p.estado = 'cerrado';
    Storage.saveCollection('pedidos', pedidos);
    syncMesaEstados();
  }

  function pedidosConPlatosListos() {
    return getPedidos().filter(
      (p) => p.estado === 'abierto' && p.items.some((i) => i.estado === 'listo')
    );
  }

  // ---------- Despachos ----------
  function getDespachos() {
    return Storage.getCollection('despachos');
  }

  // Crea despacho desde un pedido con platos listos
  function crearDespacho(pedidoId, creadoPor) {
    const despachos = getDespachos();
    const pedido = getPedidos().find((p) => p.id === Number(pedidoId));
    if (!pedido) throw new Error('Pedido no encontrado.');
    const itemsListos = pedido.items.filter((i) => i.estado === 'listo');
    if (!itemsListos.length) throw new Error('No hay platos listos para despachar.');

    // Excluye platos que ya fueron despachados previamente
    const yaDespachados = despachadosPlatos(pedido.id);
    const aDespachar = itemsListos.filter((i) => !yaDespachados.includes(i.platoId));
    if (!aDespachar.length) throw new Error('Ese pedido ya tiene platos despachados.');

    const despacho = {
      id: nextId(despachos, 'despacho'),
      pedidoId: pedido.id,
      mesaId: pedido.mesaId,
      mesaNombre: String(pedido.mesaNombre),
      items: aDespachar.map((i) => ({ platoId: i.platoId, nombre: i.nombre, cantidad: i.cantidad })),
      estado: 'en-ruta', // en-ruta -> entregado
      creadoPor: Storage.sanitizeString(creadoPor, 50),
      createdAt: Date.now()
    };
    despachos.push(despacho);
    Storage.saveCollection('despachos', despachos);
    // Marcar platos despachados como "despachado" para que no se repitan
    aDespachar.forEach((i) => { i.estado = 'despachado'; });
    Storage.saveCollection('pedidos', getPedidos());
    syncMesaEstados();
    return despacho;
  }

  function despachadosPlatos(pedidoId) {
    return getDespachos()
      .filter((d) => d.pedidoId === pedidoId)
      .reduce((acc, d) => acc.concat(d.items.map((i) => i.platoId)), []);
  }

  function marcarDespacho(id, estado) {
    const despachos = getDespachos();
    const d = despachos.find((x) => x.id === Number(id));
    if (!d) return;
    if (['en-ruta', 'entregado'].includes(estado)) d.estado = estado;
    Storage.saveCollection('despachos', despachos);
    syncMesaEstados();
  }

  // ---------- Estadísticas ----------
  function getStats() {
    syncMesaEstados();
    const reservas = getReservas();
    const pedidos = getPedidos();
    const despachos = getDespachos();
    const mesas = getMesas();
    const hoy = todayStr();

    const platosPendientes = pedidos.reduce((acc, p) => {
      return acc + p.items.filter((i) => ['pendiente', 'preparacion'].includes(i.estado)).length;
    }, 0);

    return {
      reservasHoy: reservas.filter((r) => r.fecha === hoy && r.estado !== 'cancelada').length,
      platosPendientes,
      despachosActivos: despachos.filter((d) => d.estado === 'en-ruta').length,
      mesasOcupadas: mesas.filter((m) => m.estado === 'ocupada').length,
      totalMesas: mesas.length,
      ventasHoy: 0
    };
  }

  // ---------- Usuarios (admin) ----------
  function getUsers() {
    return Storage.getCollection('users');
  }

  // Crea un usuario nuevo. Devuelve el usuario creado.
  async function crearUsuario(data) {
    const users = getUsers();
    const username = (data.username || '').trim().toLowerCase();
    const name = Storage.sanitizeString(data.name, 80);
    const password = String(data.password || '');
    const role = (data.role || '').toLowerCase();

    // Validaciones
    if (!/^[a-zA-Z0-9_.-]{3,30}$/.test(username)) {
      throw new Error('El usuario debe tener entre 3 y 30 caracteres (letras, números, _ . -).');
    }
    if (!name) throw new Error('Ingresa el nombre del usuario.');
    if (password.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
    if (password.length > 64) throw new Error('La contraseña es demasiado larga.');
    if (!Auth.getAllRoles().includes(role)) throw new Error('Selecciona un rol válido.');
    if (users.some((u) => String(u.username).toLowerCase() === username)) {
      throw new Error('Ese nombre de usuario ya existe.');
    }

    const { hash, salt } = await Auth.hashPassword(password, null);
    const user = { username, passHash: hash, salt, role, name };
    users.push(user);
    Storage.saveCollection('users', users);
    return user;
  }

  // Cambia la contraseña de un usuario (solo admin, o el propio usuario)
  async function cambiarContrasena(username, newPassword) {
    const users = getUsers();
    const user = users.find((u) => String(u.username).toLowerCase() === username);
    if (!user) throw new Error('Usuario no encontrado.');
    const pwd = String(newPassword || '');
    if (pwd.length < 6) throw new Error('La contraseña debe tener al menos 6 caracteres.');
    if (pwd.length > 64) throw new Error('La contraseña es demasiado larga.');
    const { hash, salt } = await Auth.hashPassword(pwd, null);
    user.passHash = hash;
    user.salt = salt;
    Storage.saveCollection('users', users);
  }

  // Cambia el rol de un usuario
  function cambiarRol(username, newRole) {
    const users = getUsers();
    const user = users.find((u) => String(u.username).toLowerCase() === username);
    if (!user) throw new Error('Usuario no encontrado.');
    if (!Auth.getAllRoles().includes(newRole)) throw new Error('Selecciona un rol válido.');
    user.role = newRole;
    Storage.saveCollection('users', users);
  }

  // Elimina un usuario
  function eliminarUsuario(username) {
    const users = getUsers();
    const idx = users.findIndex((u) => String(u.username).toLowerCase() === username);
    if (idx === -1) throw new Error('Usuario no encontrado.');
    if (users[idx].role === 'admin') throw new Error('No se puede eliminar la cuenta administrador.');
    users.splice(idx, 1);
    Storage.saveCollection('users', users);
  }

  return {
    pad,
    todayStr,
    getMesas,
    getMesa,
    syncMesaEstados,
    getReservas,
    crearReserva,
    cancelarReserva,
    getPedidos,
    crearPedido,
    marcarPlato,
    cerrarPedido,
    pedidosConPlatosListos,
    getDespachos,
    crearDespacho,
    marcarDespacho,
    getStats,
    getUsers,
    crearUsuario,
    cambiarContrasena,
    cambiarRol,
    eliminarUsuario,
    nextId
  };
})();
