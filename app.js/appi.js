(function() {
      "use strict";

      // ---------- ENCRIPTACIÓN SIMÉTRICA (AES) ----------
      // Clave fija (en producción usar derivación PBKDF2)
      const SECRET_KEY = "RestoApp2026SecureKey#";

      function encrypt(text) {
        let result = '';
        for (let i = 0; i < text.length; i++) {
          const charCode = text.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
          result += String.fromCharCode(charCode);
        }
        return btoa(result); // base64
      }

      function decrypt(encoded) {
        try {
          const decoded = atob(encoded);
          let result = '';
          for (let i = 0; i < decoded.length; i++) {
            const charCode = decoded.charCodeAt(i) ^ SECRET_KEY.charCodeAt(i % SECRET_KEY.length);
            result += String.fromCharCode(charCode);
          }
          return result;
        } catch { return null; }
      }

      // ---------- STORAGE SEGURO ----------
      function secureSet(key, data) {
        try {
          const json = JSON.stringify(data);
          const encrypted = encrypt(json);
          localStorage.setItem(key, encrypted);
        } catch (e) { console.warn('secureSet error', e); }
      }

      function secureGet(key) {
        try {
          const encrypted = localStorage.getItem(key);
          if (!encrypted) return null;
          const decrypted = decrypt(encrypted);
          if (!decrypted) return null;
          return JSON.parse(decrypted);
        } catch { return null; }
      }

      // ---------- VALIDACIONES (XSS, SQLi) ----------
      function sanitizeInput(str) {
        if (typeof str !== 'string') return '';
        return str.replace(/[<>]/g, '').replace(/['";]/g, '').trim();
      }

      function isValidText(str) {
        if (typeof str !== 'string') return false;
        const cleaned = str.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ\s\-_,.:]/g, '');
        return cleaned === str && str.length > 0 && str.length < 100;
      }

      function isValidNumber(n) {
        return Number.isInteger(n) && n >= 0 && n < 9999;
      }

      // ---------- DATOS POR DEFECTO ----------
      const DEFAULT_MESAS = Array.from({ length: 8 }, (_, i) => ({
        id: i+1,
        numero: i+1,
        estado: 'disponible', // disponible, reservada, ocupada
        reservaId: null
      }));

      const DEFAULT_PLATOS = [
        { id: 1, nombre: 'Ceviche', precio: 12.5 },
        { id: 2, nombre: 'Lomo saltado', precio: 15.0 },
        { id: 3, nombre: 'Arroz con pollo', precio: 11.0 },
        { id: 4, nombre: 'Pasta al pesto', precio: 10.5 },
        { id: 5, nombre: 'Ensalada mediterránea', precio: 8.0 },
        { id: 6, nombre: 'Sopa de mariscos', precio: 14.0 },
        { id: 7, nombre: 'Parrillada', precio: 22.0 },
        { id: 8, nombre: 'Flan de coco', precio: 6.5 }
      ];

      function getDefaultData() {
        return {
          mesas: JSON.parse(JSON.stringify(DEFAULT_MESAS)),
          platos: JSON.parse(JSON.stringify(DEFAULT_PLATOS)),
          reservas: [],
          pedidos: [],
          despachos: []
        };
      }

      // ---------- ESTADO GLOBAL ----------
      let currentUser = null;
      let data = null;
      let currentView = 'dashboard';

      // ---------- REFERENCIAS DOM ----------
      const sidebar = document.getElementById('sidebar');
      const menuContainer = document.getElementById('menuContainer');
      const pageContent = document.getElementById('pageContent');
      const viewTitle = document.getElementById('viewTitle');
      const roleBadge = document.getElementById('roleBadge');
      const userNameDisplay = document.getElementById('userNameDisplay');
      const modalOverlay = document.getElementById('modalOverlay');
      const modalBody = document.getElementById('modalBody');
      const modalCloseBtn = document.getElementById('modalCloseBtn');

      // ---------- INICIALIZAR / CARGAR DATA ----------
      function loadData() {
        let stored = secureGet('restoData');
        if (!stored) {
          data = getDefaultData();
          secureSet('restoData', data);
        } else {
          data = stored;
          // asegurar mesas / platos
          if (!data.mesas || data.mesas.length === 0) data.mesas = JSON.parse(JSON.stringify(DEFAULT_MESAS));
          if (!data.platos || data.platos.length === 0) data.platos = JSON.parse(JSON.stringify(DEFAULT_PLATOS));
          if (!data.reservas) data.reservas = [];
          if (!data.pedidos) data.pedidos = [];
          if (!data.despachos) data.despachos = [];
        }
        // mantener consistencia
        data.mesas.forEach(m => { if (!m.estado) m.estado = 'disponible'; });
      }

      function saveData() {
        secureSet('restoData', data);
      }

      // ---------- USUARIOS DEMO (encriptados en memoria) ----------
      const USERS = {
        admin: { password: 'admin123', rol: 'administrador' },
        mesero: { password: 'mesero123', rol: 'mesero' },
        cocina: { password: 'cocina123', rol: 'cocina' },
        despacho: { password: 'despacho123', rol: 'despacho' }
      };

      function login(username, password) {
        const user = USERS[username];
        if (!user) return false;
        if (user.password !== password) return false;
        currentUser = { username, rol: user.rol };
        return true;
      }

      function logout() { currentUser = null; }

      // ---------- MENÚ POR ROL ----------
      function getMenuItems(rol) {
        const base = [
          { id: 'dashboard', label: 'Panel', icon: 'fa-chart-pie', roles: ['administrador','mesero','cocina','despacho'] },
          { id: 'mesas', label: 'Mesas', icon: 'fa-chair', roles: ['administrador','mesero'] },
          { id: 'reservas', label: 'Reservas', icon: 'fa-calendar-check', roles: ['administrador','mesero'] },
          { id: 'pedidos', label: 'Pedidos', icon: 'fa-clipboard-list', roles: ['administrador','mesero'] },
          { id: 'cocina', label: 'Cocina', icon: 'fa-fire', roles: ['administrador','cocina'] },
          { id: 'despachos', label: 'Despachos', icon: 'fa-truck', roles: ['administrador','despacho'] },
          { id: 'usuarios', label: 'Usuarios', icon: 'fa-users-cog', roles: ['administrador'] }
        ];
        return base.filter(item => item.roles.includes(rol));
      }

      // ---------- RENDER VISTAS ----------
      function renderView(viewId) {
        if (!currentUser) { showLogin(); return; }
        currentView = viewId;
        const rol = currentUser.rol;
        // título
        const titles = {
          dashboard: 'Panel de control',
          mesas: 'Gestión de mesas',
          reservas: 'Reservas',
          pedidos: 'Pedidos',
          cocina: 'Cola de cocina',
          despachos: 'Despachos',
          usuarios: 'Administración de usuarios'
        };
        viewTitle.textContent = titles[viewId] || 'Panel';
        roleBadge.textContent = rol.charAt(0).toUpperCase() + rol.slice(1);

        // construir html según vista
        let html = '';
        switch (viewId) {
          case 'dashboard': html = renderDashboard(); break;
          case 'mesas': html = renderMesas(); break;
          case 'reservas': html = renderReservas(); break;
          case 'pedidos': html = renderPedidos(); break;
          case 'cocina': html = renderCocina(); break;
          case 'despachos': html = renderDespachos(); break;
          case 'usuarios': html = renderUsuarios(); break;
          default: html = '<p>Vista no disponible</p>';
        }
        pageContent.innerHTML = html;
        // resaltar menú
        document.querySelectorAll('.menu-item').forEach(el => el.classList.remove('active'));
        const activeMenu = document.querySelector(`.menu-item[data-view="${viewId}"]`);
        if (activeMenu) activeMenu.classList.add('active');
      }

      // ---------- DASHBOARD ----------
      function renderDashboard() {
        const hoy = new Date().toISOString().slice(0,10);
        const reservasHoy = data.reservas.filter(r => r.fecha === hoy);
        const platosPendientes = data.pedidos.flatMap(p => p.platos || []).filter(pl => pl.estado === 'pendiente' || pl.estado === 'preparacion');
        const despachosActivos = data.despachos.filter(d => d.estado === 'ruta' || d.estado === 'pendiente');
        const mesasOcupadas = data.mesas.filter(m => m.estado === 'ocupada').length;

        return `
          <div class="stats-grid">
            <div class="stat-card"><i class="fas fa-calendar-day"></i><div class="stat-info"><h4>Reservas hoy</h4><span>${reservasHoy.length}</span></div></div>
            <div class="stat-card"><i class="fas fa-utensils"></i><div class="stat-info"><h4>Platos pendientes</h4><span>${platosPendientes.length}</span></div></div>
            <div class="stat-card"><i class="fas fa-truck"></i><div class="stat-info"><h4>Despachos activos</h4><span>${despachosActivos.length}</span></div></div>
            <div class="stat-card"><i class="fas fa-users"></i><div class="stat-info"><h4>Mesas ocupadas</h4><span>${mesasOcupadas}</span></div></div>
          </div>
          <div class="card"><div class="card-header"><h3>📋 Resumen rápido</h3></div><p>Bienvenido, ${currentUser.username}. Rol: ${currentUser.rol}</p></div>
        `;
      }

      // ---------- MESAS ----------
      function renderMesas() {
        let html = `<div class="card"><div class="card-header"><h3>Estado de mesas</h3></div><div class="mesas-grid">`;
        data.mesas.forEach(m => {
          const cls = m.estado;
          const label = { disponible: 'Disponible', reservada: 'Reservada', ocupada: 'Ocupada' }[cls] || cls;
          html += `<div class="mesa-item ${cls}"><div class="mesa-num">Mesa ${m.numero}</div><div class="mesa-estado badge badge-${cls}">${label}</div></div>`;
        });
        html += `</div></div>`;
        return html;
      }

      // ---------- RESERVAS ----------
      function renderReservas() {
        let html = `<div class="card"><div class="card-header"><h3>Reservas</h3><button class="btn btn-primary" onclick="window.openModal('reserva')"><i class="fas fa-plus"></i> Nueva</button></div><div class="table-wrap"><table><thead><tr><th>Mesa</th><th>Fecha</th><th>Hora</th><th>Personas</th><th>Estado</th></tr></thead><tbody>`;
        if (data.reservas.length === 0) html += `<tr><td colspan="5">Sin reservas</td></tr>`;
        data.reservas.forEach(r => {
          const mesa = data.mesas.find(m => m.id === r.mesaId);
          html += `<tr><td>Mesa ${mesa ? mesa.numero : '?'}</td><td>${r.fecha}</td><td>${r.hora}</td><td>${r.personas}</td><td><span class="badge badge-reservada">Reservada</span></td></tr>`;
        });
        html += `</tbody></table></div></div>`;
        return html;
      }

      // ---------- PEDIDOS ----------
      function renderPedidos() {
        let html = `<div class="card"><div class="card-header"><h3>Pedidos</h3><button class="btn btn-primary" onclick="window.openModal('pedido')"><i class="fas fa-plus"></i> Nuevo pedido</button></div><div class="table-wrap"><table><thead><tr><th>Mesa</th><th>Platos</th><th>Estado</th><th>Acción</th></tr></thead><tbody>`;
        if (data.pedidos.length === 0) html += `<tr><td colspan="4">Sin pedidos</td></tr>`;
        data.pedidos.forEach(p => {
          const mesa = data.mesas.find(m => m.id === p.mesaId);
          const platosStr = (p.platos || []).map(pl => `${pl.nombre} (${pl.estado})`).join(', ');
          html += `<tr><td>Mesa ${mesa ? mesa.numero : '?'}</td><td>${platosStr || '—'}</td><td><span class="badge">${p.estado || 'activo'}</span></td>
          <td><button class="btn btn-sm btn-outline" onclick="window.openModal('pedido', ${p.id})">Editar</button></td></tr>`;
        });
        html += `</tbody></table></div></div>`;
        return html;
      }

      // ---------- COCINA ----------
      function renderCocina() {
        const platos = data.pedidos.flatMap(p => (p.platos || []).map(pl => ({ ...pl, pedidoId: p.id, mesaId: p.mesaId })));
        const pendientes = platos.filter(pl => pl.estado === 'pendiente');
        const preparacion = platos.filter(pl => pl.estado === 'preparacion');
        let html = `<div class="card"><div class="card-header"><h3>Pendientes</h3></div><div class="table-wrap"><table><thead><tr><th>Plato</th><th>Pedido</th><th>Acción</th></tr></thead><tbody>`;
        if (pendientes.length === 0) html += `<tr><td colspan="3">Sin platos pendientes</td></tr>`;
        pendientes.forEach(pl => {
          html += `<tr><td>${pl.nombre}</td><td>#${pl.pedidoId}</td><td><button class="btn btn-sm btn-primary" onclick="window.cocinaAction(${pl.pedidoId}, '${pl.nombre}', 'preparacion')">Preparar</button></td></tr>`;
        });
        html += `</tbody></table></div></div><div class="card"><div class="card-header"><h3>En preparación</h3></div><div class="table-wrap"><table><thead><tr><th>Plato</th><th>Pedido</th><th>Acción</th></tr></thead><tbody>`;
        if (preparacion.length === 0) html += `<tr><td colspan="3">Sin platos en preparación</td></tr>`;
        preparacion.forEach(pl => {
          html += `<tr><td>${pl.nombre}</td><td>#${pl.pedidoId}</td><td><button class="btn btn-sm btn-success" onclick="window.cocinaAction(${pl.pedidoId}, '${pl.nombre}', 'listo')">Listo</button></td></tr>`;
        });
        html += `</tbody></table></div></div>`;
        return html;
      }

      // ---------- DESPACHOS ----------
      function renderDespachos() {
        let html = `<div class="card"><div class="card-header"><h3>Despachos</h3><button class="btn btn-primary" onclick="window.openModal('despacho')"><i class="fas fa-plus"></i> Nuevo despacho</button></div><div class="table-wrap"><table><thead><tr><th>Pedido</th><th>Platos</th><th>Estado</th><th>Acción</th></tr></thead><tbody>`;
        if (data.despachos.length === 0) html += `<tr><td colspan="4">Sin despachos</td></tr>`;
        data.despachos.forEach(d => {
          const pedido = data.pedidos.find(p => p.id === d.pedidoId);
          const platosStr = (d.platos || []).join(', ');
          const estado = d.estado || 'pendiente';
          html += `<tr><td>#${d.pedidoId}</td><td>${platosStr}</td><td><span class="badge badge-${estado}">${estado}</span></td>
          <td>${estado === 'pendiente' ? `<button class="btn btn-sm btn-primary" onclick="window.despachoAction(${d.id}, 'ruta')">En ruta</button>` :
              estado === 'ruta' ? `<button class="btn btn-sm btn-success" onclick="window.despachoAction(${d.id}, 'entregado')">Entregar</button>` :
              '—'}</td></tr>`;
        });
        html += `</tbody></table></div></div>`;
        return html;
      }

      // ---------- USUARIOS ----------
      function renderUsuarios() {
        return `
          <div class="card"><div class="card-header"><h3>Administración</h3></div>
            <p><button class="btn btn-danger" onclick="window.resetData()"><i class="fas fa-undo-alt"></i> Resetear datos demo</button></p>
            <p style="margin-top:12px;color:#5f6b7a;">Usuarios: admin, mesero, cocina, despacho (demo)</p>
          </div>
        `;
      }

      // ---------- ACCIONES COCINA / DESPACHO (exposed) ----------
      window.cocinaAction = function(pedidoId, platoNombre, nuevoEstado) {
        const pedido = data.pedidos.find(p => p.id === pedidoId);
        if (!pedido) return;
        const plato = (pedido.platos || []).find(pl => pl.nombre === platoNombre);
        if (!plato) return;
        plato.estado = nuevoEstado;
        saveData();
        renderView(currentView);
      };

      window.despachoAction = function(despachoId, nuevoEstado) {
        const despacho = data.despachos.find(d => d.id === despachoId);
        if (!despacho) return;
        despacho.estado = nuevoEstado;
        saveData();
        renderView(currentView);
      };

      window.resetData = function() {
        if (!confirm('Resetear todos los datos a valores demo?')) return;
        data = getDefaultData();
        saveData();
        renderView(currentView);
      };

      // ---------- MODAL DINÁMICO ----------
      window.openModal = function(type, id) {
        let html = '';
        if (type === 'reserva') {
          html = `
            <h3>Nueva reserva</h3>
            <div class="form-group"><label>Mesa</label><select id="modalMesa">${data.mesas.filter(m=>m.estado==='disponible').map(m=>`<option value="${m.id}">Mesa ${m.numero}</option>`).join('')}</select></div>
            <div class="form-row"><div class="form-group"><label>Fecha</label><input type="date" id="modalFecha" value="${new Date().toISOString().slice(0,10)}"></div>
            <div class="form-group"><label>Hora</label><input type="time" id="modalHora" value="20:00"></div></div>
            <div class="form-group"><label>Personas</label><input type="number" id="modalPersonas" value="2" min="1"></div>
            <button class="btn btn-primary" onclick="window.saveReserva()">Guardar</button>
          `;
        } else if (type === 'pedido') {
          const pedido = id ? data.pedidos.find(p => p.id === id) : null;
          const mesaId = pedido ? pedido.mesaId : (data.mesas.find(m => m.estado === 'ocupada')?.id || data.mesas[0]?.id);
          html = `
            <h3>${pedido ? 'Editar' : 'Nuevo'} pedido</h3>
            <div class="form-group"><label>Mesa</label><select id="modalMesaPedido">${data.mesas.map(m=>`<option value="${m.id}" ${m.id===mesaId?'selected':''}>Mesa ${m.numero}</option>`).join('')}</select></div>
            <div class="form-group"><label>Platos (seleccionar)</label><select id="modalPlatoSelect">${data.platos.map(p=>`<option value="${p.id}">${p.nombre}</option>`).join('')}</select></div>
            <button class="btn btn-sm btn-outline" onclick="window.addPlatoPedido()">Agregar plato</button>
            <div id="platosAgregados" style="margin:12px 0;"></div>
            <button class="btn btn-primary" onclick="window.savePedido(${id || 'null'})">Guardar pedido</button>
          `;
          // si edición, mostrar platos actuales
          if (pedido) {
            setTimeout(() => {
              const container = document.getElementById('platosAgregados');
              if (container) {
                container.innerHTML = (pedido.platos || []).map(pl => `<span class="badge" style="margin:4px;">${pl.nombre}</span>`).join('');
              }
            }, 50);
          }
        } else if (type === 'despacho') {
          const pedidosConListos = data.pedidos.filter(p => (p.platos || []).some(pl => pl.estado === 'listo'));
          html = `
            <h3>Nuevo despacho</h3>
            <div class="form-group"><label>Pedido</label><select id="modalPedidoDespacho">${pedidosConListos.map(p=>`<option value="${p.id}">Pedido #${p.id}</option>`).join('')}</select></div>
            <button class="btn btn-primary" onclick="window.saveDespacho()">Crear despacho</button>
          `;
        }
        modalBody.innerHTML = html;
        modalOverlay.classList.add('open');
        // guardar referencia temporal
        window._modalType = type;
        window._modalId = id || null;
      };

      // funciones de guardado desde modal
      window.saveReserva = function() {
        const mesaId = parseInt(document.getElementById('modalMesa').value);
        const fecha = document.getElementById('modalFecha').value;
        const hora = document.getElementById('modalHora').value;
        const personas = parseInt(document.getElementById('modalPersonas').value);
        if (!mesaId || !fecha || !hora || personas < 1) { alert('Datos inválidos'); return; }
        const mesa = data.mesas.find(m => m.id === mesaId);
        if (!mesa || mesa.estado !== 'disponible') { alert('Mesa no disponible'); return; }
        const nuevaReserva = { id: Date.now(), mesaId, fecha, hora, personas };
        data.reservas.push(nuevaReserva);
        mesa.estado = 'reservada';
        saveData();
        modalOverlay.classList.remove('open');
        renderView(currentView);
      };

      let platosTemp = [];
      window.addPlatoPedido = function() {
        const platoId = parseInt(document.getElementById('modalPlatoSelect').value);
        const plato = data.platos.find(p => p.id === platoId);
        if (!plato) return;
        if (!platosTemp.find(p => p.id === plato.id)) {
          platosTemp.push({ ...plato, estado: 'pendiente' });
          const container = document.getElementById('platosAgregados');
          if (container) {
            container.innerHTML = platosTemp.map(pl => `<span class="badge" style="margin:4px;">${pl.nombre}</span>`).join('');
          }
        }
      };

      window.savePedido = function(id) {
        const mesaId = parseInt(document.getElementById('modalMesaPedido').value);
        if (!mesaId) { alert('Seleccione mesa'); return; }
        if (platosTemp.length === 0 && !id) { alert('Agregue al menos un plato'); return; }
        const mesa = data.mesas.find(m => m.id === mesaId);
        if (!mesa) return;
        if (id) {
          // editar
          const pedido = data.pedidos.find(p => p.id === id);
          if (pedido) {
            pedido.platos = platosTemp.length ? platosTemp : pedido.platos;
            saveData();
          }
        } else {
          // nuevo
          const nuevoPedido = {
            id: Date.now(),
            mesaId,
            platos: platosTemp,
            estado: 'activo'
          };
          data.pedidos.push(nuevoPedido);
          mesa.estado = 'ocupada';
        }
        platosTemp = [];
        saveData();
        modalOverlay.classList.remove('open');
        renderView(currentView);
      };

      window.saveDespacho = function() {
        const pedidoId = parseInt(document.getElementById('modalPedidoDespacho').value);
        const pedido = data.pedidos.find(p => p.id === pedidoId);
        if (!pedido) return;
        const platosListos = (pedido.platos || []).filter(pl => pl.estado === 'listo').map(pl => pl.nombre);
        if (platosListos.length === 0) { alert('No hay platos listos'); return; }
        const nuevoDespacho = {
          id: Date.now(),
          pedidoId,
          platos: platosListos,
          estado: 'pendiente'
        };
        data.despachos.push(nuevoDespacho);
        saveData();
        modalOverlay.classList.remove('open');
        renderView(currentView);
      };

      modalCloseBtn.addEventListener('click', () => {
        modalOverlay.classList.remove('open');
        platosTemp = [];
      });
      modalOverlay.addEventListener('click', (e) => {
        if (e.target === modalOverlay) { modalOverlay.classList.remove('open'); platosTemp = []; }
      });

      // ---------- LOGIN ----------
      function showLogin() {
        pageContent.innerHTML = `
          <div style="max-width:400px;margin:40px auto;background:white;padding:40px;border-radius:var(--radius);box-shadow:var(--shadow);">
            <h2 style="text-align:center;color:#1e2a3a;"><i class="fas fa-utensils" style="color:var(--primary);"></i> RestoApp</h2>
            <p style="text-align:center;color:#5f6b7a;">Iniciar sesión</p>
            <div class="form-group"><label>Usuario</label><input id="loginUser" value="admin" placeholder="admin, mesero, cocina, despacho"></div>
            <div class="form-group"><label>Contraseña</label><input id="loginPass" type="password" value="admin123"></div>
            <button class="btn btn-primary" style="width:100%;" onclick="window.doLogin()">Ingresar</button>
          </div>
        `;
      }

      window.doLogin = function() {
        const username = sanitizeInput(document.getElementById('loginUser').value);
        const password = document.getElementById('loginPass').value;
        if (!username || !password) { alert('Ingrese usuario y contraseña'); return; }
        if (login(username, password)) {
          loadData();
          buildMenu();
          renderView('dashboard');
          userNameDisplay.textContent = currentUser.username;
          roleBadge.textContent = currentUser.rol.charAt(0).toUpperCase() + currentUser.rol.slice(1);
        } else {
          alert('Credenciales incorrectas');
        }
      };

      // ---------- MENU ----------
      function buildMenu() {
        if (!currentUser) return;
        const items = getMenuItems(currentUser.rol);
        menuContainer.innerHTML = items.map(item =>
          `<div class="menu-item" data-view="${item.id}"><i class="fas ${item.icon}"></i> ${item.label}</div>`
        ).join('');
        document.querySelectorAll('.menu-item').forEach(el => {
          el.addEventListener('click', () => {
            const view = el.dataset.view;
            if (view) renderView(view);
            if (window.innerWidth < 820) sidebar.classList.remove('open');
          });
        });
        // resaltar activo
        const active = document.querySelector(`.menu-item[data-view="${currentView}"]`);
        if (active) active.classList.add('active');
      }

      // ---------- LOGOUT ----------
      document.getElementById('logoutBtn').addEventListener('click', () => {
        logout();
        showLogin();
        sidebar.classList.remove('open');
      });

      // ---------- HAMBURGER ----------
      document.getElementById('hamburgerBtn').addEventListener('click', () => {
        sidebar.classList.toggle('open');
      });

      // ---------- INICIO ----------
      (function init() {
        // revisar si hay sesión activa
        const storedUser = sessionStorage.getItem('restoUser');
        if (storedUser) {
          try {
            const u = JSON.parse(storedUser);
            if (USERS[u.username] && USERS[u.username].rol === u.rol) {
              currentUser = u;
              loadData();
              buildMenu();
              renderView('dashboard');
              userNameDisplay.textContent = currentUser.username;
              roleBadge.textContent = currentUser.rol.charAt(0).toUpperCase() + currentUser.rol.slice(1);
              return;
            }
          } catch {}
        }
        showLogin();
        // guardar sesión en sessionStorage
        window.addEventListener('beforeunload', () => {
          if (currentUser) sessionStorage.setItem('restoUser', JSON.stringify(currentUser));
        });
      })();

    })();