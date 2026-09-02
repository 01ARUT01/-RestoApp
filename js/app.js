/* =========================================================
   RestoApp - Sistema de Reservas de Restaurante
   js/app.js  ->  CONTROLADOR principal
   - Render de vistas por rol (menu, mesas, reservas, pedidos,
     cocina, despacho, usuarios) y modales
   Expone el objeto global: window.App
   ========================================================= */
window.App = (() => {
  const MENU = [
    { view: 'dashboard', label: 'Panel', icon: 'fas fa-chart-line', roles: ['admin'] },
    { view: 'mesas', label: 'Mesas', icon: 'fas fa-chair', roles: ['admin', 'mesero'] },
    { view: 'reservas', label: 'Reservas', icon: 'fas fa-calendar-check', roles: ['admin', 'mesero'] },
    { view: 'pedidos', label: 'Pedidos', icon: 'fas fa-clipboard-list', roles: ['admin', 'mesero'] },
    { view: 'cocina', label: 'Cocina', icon: 'fas fa-fire-burner', roles: ['admin', 'cocina'] },
    { view: 'despacho', label: 'Despacho', icon: 'fas fa-truck-fast', roles: ['admin', 'mesero', 'despacho'] },
    { view: 'usuarios', label: 'Usuarios', icon: 'fas fa-users-cog', roles: ['admin'] }
  ];

  const VIEW_TITLES = {
    dashboard: 'Panel de control',
    mesas: 'Mesas',
    reservas: 'Reservas',
    pedidos: 'Pedidos',
    cocina: 'Cocina',
    despacho: 'Despachos',
    usuarios: 'Usuarios y seguridad'
  };

  let currentView = null;

  // ---------- Referencias DOM ----------
  const $ = (id) => document.getElementById(id);
  const els = {};

  function cacheEls() {
    els.overlay = $('modalOverlay');
    els.modalContent = $('modalContent');
    els.modalBody = $('modalBody');
    els.menuContainer = $('menuContainer');
    els.pageContent = $('pageContent');
    els.viewTitle = $('viewTitle');
    els.roleBadge = $('roleBadge');
    els.userNameDisplay = $('userNameDisplay');
    els.hamburger = $('hamburgerBtn');
    els.sidebar = $('sidebar');
    els.modalClose = $('modalCloseBtn');
    els.logoutBtn = $('logoutBtn');
  }

  // ---------- Utilidades de render ----------
  function htmlEscape(v) {
    return Storage.escapeHtml(v);
  }

  function showLogin() {
    document.body.innerHTML = renderLogin();
    bindLoginEvents();
  }

  function renderLogin() {
    return `
      <div class="login-screen">
        <div class="login-card">
          <div class="login-logo">
            <div class="icon"><i class="fas fa-utensils"></i></div>
            <h1>RestoApp</h1>
            <p>Sistema de Reservas de Restaurante</p>
          </div>
          <div id="loginError" class="alert alert-danger" style="display:none"></div>
          <form id="loginForm">
            <div class="form-group">
              <label for="username">Usuario</label>
              <input type="text" id="username" name="username" autocomplete="username" placeholder="admin" maxlength="30" required>
            </div>
            <div class="form-group">
              <label for="password">Contraseña</label>
              <input type="password" id="password" name="password" autocomplete="current-password" maxlength="64" required>
            </div>
            <button type="submit" class="btn btn-accent btn-block"><i class="fas fa-sign-in-alt"></i> Ingresar</button>
          </form>
          <div class="login-hint">
            <strong>Usuarios demo:</strong><br>
            <code>admin</code> / admin123<br>
            <code>mesero</code> / mesero123<br>
            <code>cocina</code> / cocina123<br>
            <code>despacho</code> / despacho123
          </div>
        </div>
      </div>
    `;
  }

  function bindLoginEvents() {
    const form = $('loginForm');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errBox = $('loginError');
      const username = $('username').value;
      const password = $('password').value;
      errBox.style.display = 'none';
      try {
        await Auth.login(username, password);
        bootApp();
      } catch (err) {
        errBox.textContent = err.message || 'Error de autenticación.';
        errBox.style.display = 'flex';
      }
    });
  }

  // ---------- Arranque de la app autenticada ----------
  function renderShell() {
    const user = Auth.currentUser();
    return `
      <div class="app" id="app">
        <aside class="sidebar" id="sidebar">
          <div class="sidebar-header">
            <h2><i class="fas fa-utensils"></i><span> RestoApp</span></h2>
          </div>
          <div class="sidebar-menu" id="menuContainer"></div>
          <div class="sidebar-footer">
            <div class="user-badge"><i class="fas fa-user-circle"></i> <span id="userNameDisplay">${htmlEscape(user.name || user.username)}</span></div>
            <button class="logout-btn" id="logoutBtn"><i class="fas fa-sign-out-alt"></i> <span>Cerrar sesión</span></button>
          </div>
        </aside>
        <div class="sidebar-backdrop" id="sidebarBackdrop"></div>
        <div class="main-content">
          <div class="topbar">
            <span class="hamburger" id="hamburgerBtn"><i class="fas fa-bars"></i></span>
            <h3 id="viewTitle">Panel</h3>
            <span class="role-badge" id="roleBadge">${htmlEscape(Auth.roleLabel(user.role))}</span>
          </div>
          <div class="page-content" id="pageContent"></div>
        </div>
        <div class="modal-overlay" id="modalOverlay">
          <div class="modal" id="modalContent">
            <button class="close-modal" id="modalCloseBtn">&times;</button>
            <div id="modalBody"></div>
          </div>
        </div>
      </div>
    `;
  }

  function buildMenu() {
    const user = Auth.currentUser();
    const items = MENU.filter((m) => m.roles.includes(user.role)).map((m) => {
      const act = m.view === currentView ? ' active' : '';
      return `<button class="menu-item${act}" data-view="${m.view}">
        <i class="${m.icon}"></i><span class="menu-label">${htmlEscape(m.label)}</span>
      </button>`;
    });
    els.menuContainer.innerHTML = items.join('');
    els.menuContainer.querySelectorAll('.menu-item').forEach((el) => {
      el.addEventListener('click', () => navigate(el.dataset.view));
    });
  }

  function navigate(view) {
    if (!Auth.hasAccess(view)) {
      view = 'dashboard';
      if (!Auth.hasAccess(view)) view = 'mesas';
    }
    currentView = view;
    els.viewTitle.textContent = VIEW_TITLES[view] || 'Panel';
    buildMenu();
    renderView(view);
    if (window.innerWidth <= 768) {
      els.sidebar.classList.remove('sidebar-open');
      $('sidebarBackdrop').classList.remove('show');
    }
  }

  // ---------- Render de vistas ----------
  function renderView(view) {
    const router = {
      dashboard: renderDashboard,
      mesas: renderMesas,
      reservas: renderReservas,
      pedidos: renderPedidos,
      cocina: renderCocina,
      despacho: renderDespacho,
      usuarios: renderUsuarios
    };
    const fn = router[view] || renderDashboard;
    els.pageContent.innerHTML = fn();
    bindViewEvents(view);
  }

  // ---- Dashboard ----
  function renderDashboard() {
    const s = Modules.getStats();
    return `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-icon" style="background:var(--info)"><i class="fas fa-calendar-day"></i></div>
          <div><div class="stat-value">${s.reservasHoy}</div><div class="stat-label">Reservas del día</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:var(--warning)"><i class="fas fa-hourglass-half"></i></div>
          <div><div class="stat-value">${s.platosPendientes}</div><div class="stat-label">Platos pendientes</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:var(--accent)"><i class="fas fa-truck-fast"></i></div>
          <div><div class="stat-value">${s.despachosActivos}</div><div class="stat-label">Despachos activos</div></div></div>
        <div class="stat-card"><div class="stat-icon" style="background:var(--danger)"><i class="fas fa-chair"></i></div>
          <div><div class="stat-value">${s.mesasOcupadas} / ${s.totalMesas}</div><div class="stat-label">Mesas ocupadas</div></div></div>
      </div>
      ${renderMesas()}
    `;
  }

  // ---- Mesas (vista visual) ----
  function renderMesas() {
    Modules.syncMesaEstados();
    const mesas = Modules.getMesas();
    const cards = mesas.map((m) => {
      const estadoLabel = m.estado === 'ocupada' ? 'Ocupada' : m.estado === 'reservada' ? 'Reservada' : 'Disponible';
      const icon = m.estado === 'ocupada' ? 'fa-user-group' : m.estado === 'reservada' ? 'fa-calendar' : 'fa-check';
      return `
        <div class="table-card ${htmlEscape(m.estado)}" data-mesa="${m.id}">
          <div class="table-icon"><i class="fas ${icon}"></i></div>
          <div class="table-name">${htmlEscape(m.nombre)}</div>
          <div class="table-capacity">Capacidad: ${m.capacidad} pers.</div>
          <div class="table-status">${estadoLabel}</div>
        </div>`;
    }).join('');
    return `<div class="section-title"><i class="fas fa-chair"></i> Mesas del restaurante</div>
      <div class="tables-grid">${cards}</div>`;
  }

  // ---- Reservas ----
  function renderReservas() {
    Modules.syncMesaEstados();
    const reservas = Modules.getReservas().slice().reverse();
    const mesas = Modules.getMesas();
    const lista = reservas.length
      ? reservas.map((r) => {
          const mesa = mesas.find((m) => m.id === r.mesaId);
          const estadoClass = r.estado === 'cancelada' ? 'cancelado' : 'confirmada';
          return `
            <div class="list-item">
              <div class="item-main">
                <div class="item-title">${htmlEscape(r.nombreCliente)} <span class="status-pill ${estadoClass}">${htmlEscape(r.estado)}</span></div>
                <div class="item-sub">${htmlEscape(mesa ? mesa.nombre : 'Mesa eliminada')} · ${htmlEscape(r.fecha)} ${htmlEscape(r.hora)} · ${r.personas} pers.</div>
              </div>
              <div class="item-actions">
                ${r.estado !== 'cancelada' ? `<button class="btn btn-sm btn-danger" data-cancelar="${r.id}"><i class="fas fa-times"></i> Cancelar</button>` : ''}
              </div>
            </div>`;
        }).join('')
      : '<div class="empty-state"><i class="fas fa-calendar-plus"></i>No hay reservas registradas</div>';

    return `
      <div class="panel">
        <div class="panel-header">
          <h3><i class="fas fa-calendar-check"></i> Reservas</h3>
          <button class="btn btn-primary" id="btnNuevaReserva"><i class="fas fa-plus"></i> Nueva reserva</button>
        </div>
        <div class="list-group">${lista}</div>
      </div>`;
  }

  // ---- Pedidos ----
  function renderPedidos() {
    Modules.syncMesaEstados();
    const pedidos = Modules.getPedidos().slice().reverse();
    const platos = Storage.getCollection('platos');
    const mesas = Modules.getMesas();

    const lista = pedidos.map((p) => {
      const mesa = mesas.find((m) => m.id === p.mesaId);
      const itemsHtml = p.items.map((i) => {
        const st = i.estado === 'listo' ? 'listo' : i.estado === 'despachado' ? 'entregado' : i.estado;
        return `<div style="margin:3px 0">
          <span class="status-pill ${st}">${htmlEscape(i.estado)}</span> ${htmlEscape(i.nombre)} x ${i.cantidad}
        </div>`;
      }).join('');
      return `
        <div class="list-item">
          <div class="item-main">
            <div class="item-title">#${p.id} · ${htmlEscape(p.mesaNombre)} <span class="status-pill ${p.estado === 'cerrado' ? 'entregado' : 'pendiente'}">${htmlEscape(p.estado)}</span></div>
            <div class="item-sub">${itemsHtml}</div>
            <div class="item-sub" style="margin-top:4px"><strong>Total: $${p.total.toLocaleString()}</strong></div>
          </div>
          <div class="item-actions">
            <button class="btn btn-sm btn-ghost" data-pedido-detalle="${p.id}"><i class="fas fa-eye"></i> Platos</button>
          </div>
        </div>`;
    }).join('') || '<div class="empty-state"><i class="fas fa-clipboard-list"></i>No hay pedidos registrados</div>';

    return `
      <div class="panel">
        <div class="panel-header">
          <h3><i class="fas fa-clipboard-list"></i> Pedidos por mesa</h3>
          <button class="btn btn-primary" id="btnNuevoPedido"><i class="fas fa-plus"></i> Nuevo pedido</button>
        </div>
        <div class="list-group">${lista}</div>
      </div>`;
  }

  // ---- Cocina ----
  function renderCocina() {
    const pedidos = Modules.getPedidos().filter((p) => p.estado === 'abierto');
    const colPendiente = [];
    const colPreparacion = [];
    pedidos.forEach((p) => {
      p.items.forEach((i) => {
        if (i.estado === 'pendiente') colPendiente.push({ ...i, pedido: p });
        else if (i.estado === 'preparacion') colPreparacion.push({ ...i, pedido: p });
      });
    });

    const itemCard = (i) => `
      <div class="queue-item" data-plato-pedido="${i.pedido.id}" data-plato-id="${i.platoId}">
        <div class="q-meta">#${i.pedido.id} · ${htmlEscape(i.pedido.mesaNombre)}</div>
        <div class="q-plates"><strong>${htmlEscape(i.nombre)}</strong> x ${i.cantidad}</div>
        <div class="q-actions">
          ${i.estado === 'pendiente'
            ? `<button class="btn btn-sm btn-accent" data-accion-plato="preparacion"><i class="fas fa-flame"></i> En preparación</button>`
            : `<button class="btn btn-sm btn-success" data-accion-plato="listo"><i class="fas fa-check"></i> Listo</button>`}
        </div>
      </div>`;

    return `
      <div class="section-title"><i class="fas fa-fire-burner"></i> Cola de cocina</div>
      <div class="queues-grid">
        <div class="queue-column">
          <h4><i class="fas fa-clock" style="color:var(--warning)"></i> Pendientes <span class="count">${colPendiente.length}</span></h4>
          ${colPendiente.map(itemCard).join('') || '<div class="empty-state">Sin pendientes</div>'}
        </div>
        <div class="queue-column">
          <h4><i class="fas fa-flame" style="color:var(--info)"></i> En preparación <span class="count">${colPreparacion.length}</span></h4>
          ${colPreparacion.map(itemCard).join('') || '<div class="empty-state">Nada en preparación</div>'}
        </div>
      </div>`;
  }

  // ---- Despacho ----
  function renderDespacho() {
    Modules.syncMesaEstados();
    const despachos = Modules.getDespachos().slice().reverse();

    const lista = despachos.map((d) => {
      const st = d.estado === 'entregado' ? 'entregado' : 'en-ruta';
      const itemsHtml = d.items.map((i) => `${htmlEscape(i.nombre)} x ${i.cantidad}`).join(', ');
      return `
        <div class="list-item">
          <div class="item-main">
            <div class="item-title">Despacho #${d.id} · ${htmlEscape(d.mesaNombre)} <span class="status-pill ${st}">${htmlEscape(d.estado)}</span></div>
            <div class="item-sub">${itemsHtml}</div>
          </div>
          <div class="item-actions">
            ${d.estado === 'en-ruta' ? `<button class="btn btn-sm btn-success" data-despacho-entregar="${d.id}"><i class="fas fa-check-double"></i> Entregado</button>` : ''}
          </div>
        </div>`;
    }).join('') || '<div class="empty-state"><i class="fas fa-truck-fast"></i>No hay despachos</div>';

    const pedidosListos = Modules.pedidosConPlatosListos();
    const opciones = pedidosListos.map((p) => `<option value="${p.id}">#${p.id} · ${htmlEscape(p.mesaNombre)}</option>`).join('');

    return `
      <div class="panel">
        <div class="panel-header">
          <h3><i class="fas fa-truck-fast"></i> Despachos</h3>
          ${opciones ? `<button class="btn btn-primary" id="btnNuevoDespacho"><i class="fas fa-plus"></i> Nuevo despacho</button>` : ''}
        </div>
        <div class="list-group">${lista}</div>
      </div>`;
  }

  // ---- Usuarios (admin) ----
  function renderUsuarios() {
    const user = Auth.currentUser();
    const users = Modules.getUsers();
    const rows = users.map((u) => {
      const initial = (String(u.name || u.username || '?')[0] || '?').toUpperCase();
      const esPropio = String(u.username).toLowerCase() === String(user.username).toLowerCase();
      const esAdmin = u.role === 'admin';
      return `
        <tr>
          <td>
            <div class="user-main">
              <div class="avatar">${htmlEscape(initial)}</div>
              <div>
                <div class="u-name">${htmlEscape(u.name)}</div>
                <div class="u-role">@${htmlEscape(u.username)}</div>
              </div>
            </div>
          </td>
          <td><span class="status-pill" style="background:var(--primary)">${htmlEscape(Auth.roleLabel(u.role))}</span></td>
          <td>
            <div class="item-actions">
              <button class="btn btn-sm btn-ghost" data-cambiar-pass="${htmlEscape(u.username)}"><i class="fas fa-key"></i> Contraseña</button>
              <button class="btn btn-sm btn-ghost" data-cambiar-rol="${htmlEscape(u.username)}"><i class="fas fa-user-shield"></i> Rol</button>
              ${!esAdmin && !esPropio ? `<button class="btn btn-sm btn-danger" data-eliminar-user="${htmlEscape(u.username)}"><i class="fas fa-trash"></i></button>` : ''}
            </div>
          </td>
        </tr>`;
    }).join('');

    return `
      <div class="panel">
        <div class="panel-header">
          <h3><i class="fas fa-users-cog"></i> Usuarios del sistema</h3>
          <button class="btn btn-primary" id="btnNuevoUsuario"><i class="fas fa-user-plus"></i> Nuevo usuario</button>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead><tr><th>Usuario</th><th>Rol</th><th>Acciones</th></tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>
        <div class="alert alert-info" style="margin-top:14px"><i class="fas fa-shield-halved"></i>
          Las contraseñas se almacenan con hash SHA-256 y sal (nunca en texto plano). El acceso a cada vista está restringido por rol.</div>
        <div class="danger-zone">
          <h4>Zona de administración</h4>
          <p style="font-size:13px;color:var(--text-muted);margin-bottom:10px">Restablece los datos de demostración (mesas, platos, reservas, pedidos y despachos).</p>
          <button class="btn btn-danger" id="btnResetDemo"><i class="fas fa-rotate-left"></i> Resetear datos demo</button>
        </div>
      </div>`;
  }

  // ---------- Modales ----------
  function openModal(html, wide) {
    els.modalBody.innerHTML = html;
    els.modalContent.classList.toggle('wide', !!wide);
    els.overlay.classList.add('open');
  }

  function closeModal() {
    els.overlay.classList.remove('open');
    els.modalBody.innerHTML = '';
  }

  // ---------- Eventos de cada vista ----------
  function bindViewEvents(view) {
    if (view === 'mesas') bindMesasEvents();
    if (view === 'reservas') bindReservasEvents();
    if (view === 'pedidos') bindPedidosEvents();
    if (view === 'cocina') bindCocinaEvents();
    if (view === 'despacho') bindDespachoEvents();
    if (view === 'usuarios') bindUsuariosEvents();
  }

  function bindMesasEvents() {
    document.querySelectorAll('.table-card').forEach((el) => {
      el.addEventListener('click', () => {
        // Solo mesero/admin puede operar; vista informativa
      });
    });
  }

  function bindReservasEvents() {
    const btnNueva = $('btnNuevaReserva');
    if (btnNueva) btnNueva.addEventListener('click', () => {
      const mesas = Modules.getMesas();
      const opciones = mesas.map((m) => `<option value="${m.id}">${htmlEscape(m.nombre)} (${m.capacidad} pers.)</option>`).join('');
      const hoy = Modules.todayStr();
      openModal(`
        <h3>Nueva reserva</h3>
        <p class="modal-desc">Asigna una mesa, fecha y hora para el cliente.</p>
        <div class="form-row">
          <div class="form-group"><label>Nombre del cliente</label><input id="rNombre" maxlength="80" required></div>
          <div class="form-group"><label>Teléfono</label><input id="rTelefono" maxlength="20"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Mesa</label><select id="rMesa">${opciones}</select></div>
          <div class="form-group"><label>Personas</label><input type="number" id="rPersonas" min="1" max="50" value="2" required></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Fecha</label><input type="date" id="rFecha" value="${hoy}" min="${hoy}" required></div>
          <div class="form-group"><label>Hora</label><input type="time" id="rHora" value="20:00" required></div>
        </div>
        <div class="form-actions">
          <button class="btn btn-ghost" id="modalCancel">Cancelar</button>
          <button class="btn btn-primary" id="modalSave">Guardar</button>
        </div>
      `);
      $('modalCancel').addEventListener('click', closeModal);
      $('modalSave').addEventListener('click', () => {
        const user = Auth.currentUser();
        try {
          Modules.crearReserva({
            mesaId: $('rMesa').value,
            nombreCliente: $('rNombre').value,
            telefono: $('rTelefono').value,
            fecha: $('rFecha').value,
            hora: $('rHora').value,
            personas: $('rPersonas').value,
            creadoPor: user.username
          });
          closeModal();
          renderView('reservas');
          bindViewEvents('reservas');
        } catch (err) {
          showModalError(err.message);
        }
      });
    });

    document.querySelectorAll('[data-cancelar]').forEach((el) => {
      el.addEventListener('click', () => {
        Modules.cancelarReserva(el.dataset.cancelar);
        renderView('reservas');
        bindViewEvents('reservas');
      });
    });
  }

  function bindPedidosEvents() {
    const btnNuevo = $('btnNuevoPedido');
    if (btnNuevo) btnNuevo.addEventListener('click', () => {
      const mesas = Modules.getMesas().filter((m) => m.estado !== 'ocupada');
      const platos = Storage.getCollection('platos');
      const opcionesMesas = mesas.map((m) => `<option value="${m.id}">${htmlEscape(m.nombre)}</option>`).join('')
        || '<option value="">Sin mesas disponibles</option>';
      const opcionesPlatos = platos.map((p) => `<option value="${p.id}">${htmlEscape(p.nombre)} — $${p.precio.toLocaleString()}</option>`).join('');
      openModal(`
        <h3>Nuevo pedido</h3>
        <p class="modal-desc">Registra uno o más platos para una mesa.</p>
        <div class="form-group"><label>Mesa</label><select id="pMesa">${opcionesMesas}</select></div>
        <div class="form-group"><label>Platos</label><select id="pPlato">${opcionesPlatos}</select></div>
        <div class="form-row">
          <div class="form-group"><label>Cantidad</label><input type="number" id="pCantidad" min="1" max="50" value="1"></div>
          <div class="form-group" style="display:flex;align-items:flex-end">
            <button class="btn btn-ghost btn-block" id="pAdd"><i class="fas fa-plus"></i> Agregar</button>
          </div>
        </div>
        <div id="pLista" style="margin-bottom:10px"></div>
        <div class="form-actions">
          <button class="btn btn-ghost" id="modalCancel">Cancelar</button>
          <button class="btn btn-primary" id="modalSave">Guardar pedido</button>
        </div>
      `);
      const items = [];
      $('pAdd').addEventListener('click', () => {
        const platoId = Number($('pPlato').value);
        const cantidad = Math.max(1, parseInt($('pCantidad').value, 10) || 1);
        const plato = Storage.getCollection('platos').find((p) => p.id === platoId);
        if (!plato) return;
        const exist = items.find((i) => i.platoId === platoId);
        if (exist) exist.cantidad += cantidad;
        else items.push({ platoId, cantidad });
        $('pLista').innerHTML = items.map((i) => {
          const p = Storage.getCollection('platos').find((x) => x.id === i.platoId);
          return `<div>${htmlEscape(p ? p.nombre : i.platoId)} x ${i.cantidad}</div>`;
        }).join('');
      });
      $('modalCancel').addEventListener('click', closeModal);
      $('modalSave').addEventListener('click', () => {
        if (!items.length) return showModalError('Agrega al menos un plato.');
        const user = Auth.currentUser();
        try {
          Modules.crearPedido({ mesaId: $('pMesa').value, items, creadoPor: user.username });
          closeModal();
          renderView('pedidos');
          bindViewEvents('pedidos');
        } catch (err) {
          showModalError(err.message);
        }
      });
    });

    document.querySelectorAll('[data-pedido-detalle]').forEach((el) => {
      el.addEventListener('click', () => {
        const pedido = Modules.getPedidos().find((p) => p.id === Number(el.dataset.pedidoDetalle));
        if (!pedido) return;
        const rows = pedido.items.map((i) => {
          const st = i.estado === 'despachado' ? 'entregado' : i.estado;
          return `<tr><td>${htmlEscape(i.nombre)}</td><td>${i.cantidad}</td>
            <td>$${i.precio.toLocaleString()}</td><td><span class="status-pill ${st}">${htmlEscape(i.estado)}</span></td>
            <td>$${(i.precio * i.cantidad).toLocaleString()}</td></tr>`;
        }).join('');
        openModal(`
          <h3>Pedido #${pedido.id} · ${htmlEscape(pedido.mesaNombre)}</h3>
          <p class="modal-desc">Detalle de platos y estados.</p>
          <div class="table-wrap"><table class="data-table"><thead>
            <tr><th>Plato</th><th>Cant.</th><th>Precio</th><th>Estado</th><th>Subtotal</th></tr>
          </thead><tbody>${rows}</tbody></table></div>
          <div style="text-align:right;margin-top:12px;font-size:16px;font-weight:700">
            Total: $${pedido.total.toLocaleString()}
          </div>
          <div class="form-actions"><button class="btn btn-ghost" id="modalCancel">Cerrar</button></div>
        `);
        $('modalCancel').addEventListener('click', closeModal);
      });
    });
  }

  function bindCocinaEvents() {
    document.querySelectorAll('[data-accion-plato]').forEach((el) => {
      el.addEventListener('click', () => {
        const item = el.closest('.queue-item');
        const pedidoId = item.dataset.platoPedido;
        const platoId = item.dataset.platoId;
        Modules.marcarPlato(pedidoId, platoId, el.dataset.accionPlato);
        renderView('cocina');
        bindViewEvents('cocina');
      });
    });
  }

  function bindDespachoEvents() {
    const btnNuevo = $('btnNuevoDespacho');
    if (btnNuevo) btnNuevo.addEventListener('click', () => {
      const pedidos = Modules.pedidosConPlatosListos();
      const opciones = pedidos.map((p) => `<option value="${p.id}">#${p.id} · ${htmlEscape(p.mesaNombre)}</option>`).join('');
      openModal(`
        <h3>Nuevo despacho</h3>
        <p class="modal-desc">Crea un despacho desde un pedido con platos listos.</p>
        <div class="form-group"><label>Pedido</label><select id="dPedido">${opciones}</select></div>
        <div class="form-actions">
          <button class="btn btn-ghost" id="modalCancel">Cancelar</button>
          <button class="btn btn-primary" id="modalSave">Crear despacho</button>
        </div>
      `);
      $('modalCancel').addEventListener('click', closeModal);
      $('modalSave').addEventListener('click', () => {
        const user = Auth.currentUser();
        try {
          Modules.crearDespacho($('dPedido').value, user.username);
          closeModal();
          renderView('despacho');
          bindViewEvents('despacho');
        } catch (err) {
          showModalError(err.message);
        }
      });
    });

    document.querySelectorAll('[data-despacho-entregar]').forEach((el) => {
      el.addEventListener('click', () => {
        Modules.marcarDespacho(el.dataset.despachoEntregar, 'entregado');
        renderView('despacho');
        bindViewEvents('despacho');
      });
    });
  }

  function bindUsuariosEvents() {
    const btnNuevo = $('btnNuevoUsuario');
    if (btnNuevo) btnNuevo.addEventListener('click', () => {
      const opcionesRol = Auth.getAllRoles().map((r) => `<option value="${r}">${htmlEscape(Auth.roleLabel(r))}</option>`).join('');
      openModal(`
        <h3>Nuevo usuario</h3>
        <p class="modal-desc">Crea una cuenta con un rol específico y su contraseña.</p>
        <div class="form-row">
          <div class="form-group"><label>Nombre</label><input id="nuNombre" maxlength="80" placeholder="Nombre completo"></div>
          <div class="form-group"><label>Usuario</label><input id="nuUsername" maxlength="30" placeholder="usuario123"></div>
        </div>
        <div class="form-row">
          <div class="form-group"><label>Rol</label><select id="nuRol">${opcionesRol}</select></div>
          <div class="form-group"><label>Contraseña</label><input type="password" id="nuPass" maxlength="64" placeholder="Mínimo 6 caracteres"></div>
        </div>
        <div class="form-actions">
          <button class="btn btn-ghost" id="modalCancel">Cancelar</button>
          <button class="btn btn-primary" id="modalSave">Crear usuario</button>
        </div>
      `);
      $('modalCancel').addEventListener('click', closeModal);
      $('modalSave').addEventListener('click', async () => {
        try {
          await Modules.crearUsuario({
            name: $('nuNombre').value,
            username: $('nuUsername').value,
            role: $('nuRol').value,
            password: $('nuPass').value
          });
          closeModal();
          renderView('usuarios');
          bindViewEvents('usuarios');
        } catch (err) {
          showModalError(err.message);
        }
      });
    });

    document.querySelectorAll('[data-cambiar-pass]').forEach((el) => {
      el.addEventListener('click', () => {
        const username = el.dataset.cambiarPass;
        openModal(`
          <h3>Cambiar contraseña</h3>
          <p class="modal-desc">Nueva contraseña para <strong>@${htmlEscape(username)}</strong>.</p>
          <div class="form-group"><label>Nueva contraseña</label><input type="password" id="cpPass" maxlength="64" placeholder="Mínimo 6 caracteres"></div>
          <div class="form-group"><label>Confirmar</label><input type="password" id="cpPass2" maxlength="64"></div>
          <div class="form-actions">
            <button class="btn btn-ghost" id="modalCancel">Cancelar</button>
            <button class="btn btn-primary" id="modalSave">Guardar</button>
          </div>
        `);
        $('modalCancel').addEventListener('click', closeModal);
        $('modalSave').addEventListener('click', async () => {
          const a = $('cpPass').value;
          const b = $('cpPass2').value;
          if (a !== b) return showModalError('Las contraseñas no coinciden.');
          try {
            await Modules.cambiarContrasena(username, a);
            closeModal();
            alert('Contraseña actualizada.');
          } catch (err) {
            showModalError(err.message);
          }
        });
      });
    });

    document.querySelectorAll('[data-cambiar-rol]').forEach((el) => {
      el.addEventListener('click', () => {
        const username = el.dataset.cambiarRol;
        const users = Modules.getUsers();
        const u = users.find((x) => String(x.username).toLowerCase() === username);
        const opcionesRol = Auth.getAllRoles()
          .map((r) => `<option value="${r}" ${u && u.role === r ? 'selected' : ''}>${htmlEscape(Auth.roleLabel(r))}</option>`)
          .join('');
        openModal(`
          <h3>Cambiar rol</h3>
          <p class="modal-desc">Nuevo rol para <strong>@${htmlEscape(username)}</strong>.</p>
          <div class="form-group"><label>Rol</label><select id="crRol">${opcionesRol}</select></div>
          <div class="form-actions">
            <button class="btn btn-ghost" id="modalCancel">Cancelar</button>
            <button class="btn btn-primary" id="modalSave">Guardar</button>
          </div>
        `);
        $('modalCancel').addEventListener('click', closeModal);
        $('modalSave').addEventListener('click', () => {
          try {
            Modules.cambiarRol(username, $('crRol').value);
            closeModal();
            renderView('usuarios');
            bindViewEvents('usuarios');
          } catch (err) {
            showModalError(err.message);
          }
        });
      });
    });

    document.querySelectorAll('[data-eliminar-user]').forEach((el) => {
      el.addEventListener('click', () => {
        const username = el.dataset.eliminarUser;
        if (!confirm(`¿Eliminar al usuario @${username}?`)) return;
        try {
          Modules.eliminarUsuario(username);
          renderView('usuarios');
          bindViewEvents('usuarios');
        } catch (err) {
          showModalError(err.message);
        }
      });
    });

    const btnReset = $('btnResetDemo');
    if (btnReset) btnReset.addEventListener('click', async () => {
      if (!confirm('¿Restablecer todos los datos demo? Esta acción no se puede deshacer.')) return;
      // Regenera todo desde cero, luego re-hashea contraseñas demo
      Storage.resetAll();
      await Auth.ensureDemoHashes();
      Auth.logout();
      alert('Datos restablecidos. Vuelve a iniciar sesión.');
      showLogin();
    });
  }

  function showModalError(msg) {
    const box = document.createElement('div');
    box.className = 'alert alert-danger';
    box.innerHTML = `<i class="fas fa-triangle-exclamation"></i> ${htmlEscape(msg)}`;
    els.modalBody.prepend(box);
  }

  // ---------- Shell events ----------
  function bindShellEvents() {
    els.hamburger.addEventListener('click', () => {
      if (window.innerWidth <= 768) {
        els.sidebar.classList.toggle('sidebar-open');
        $('sidebarBackdrop').classList.toggle('show');
      } else {
        const app = $('app');
        app.classList.toggle('sidebar-collapsed');
      }
    });
    const backdrop = $('sidebarBackdrop');
    if (backdrop) backdrop.addEventListener('click', () => {
      els.sidebar.classList.remove('sidebar-open');
      backdrop.classList.remove('show');
    });
    els.modalClose.addEventListener('click', closeModal);
    els.overlay.addEventListener('click', (e) => {
      if (e.target === els.overlay) closeModal();
    });
    if (els.logoutBtn) els.logoutBtn.addEventListener('click', () => {
      Auth.logout();
      showLogin();
    });
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeModal();
    });
  }

  // ---------- Arranque ----------
  async function bootApp() {
    await Auth.ensureDemoHashes();
    const user = Auth.currentUser();
    if (!user) { showLogin(); return; }

    document.body.innerHTML = renderShell();
    cacheEls();
    bindShellEvents();
    const start = Auth.perms[user.role] ? Auth.perms[user.role][0] : 'dashboard';
    // Si no tiene acceso al primero, busca uno al que sí tenga
    let view = start;
    if (!Auth.hasAccess(view)) {
      view = Auth.perms[user.role].find((v) => Auth.hasAccess(v)) || 'dashboard';
    }
    currentView = view;
    els.viewTitle.textContent = VIEW_TITLES[view] || 'Panel';
    els.roleBadge.textContent = Auth.roleLabel(user.role);
    els.userNameDisplay.textContent = user.name || user.username;
    buildMenu();
    renderView(view);
  }

  async function init() {
    // Asegura que los hashes de las contraseñas demo sean válidos ANTES del login,
    // para corregir hashes guardados por versiones anteriores del algoritmo.
    await Auth.ensureDemoHashes();
    // Siempre muestra la pantalla de login al abrir la app.
    showLogin();
  }

  return { init };
})();

// Punto de entrada
document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
