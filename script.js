function obtenerReservas() {
    return JSON.parse(localStorage.getItem('reservas') || '[]');
}

function guardarReserva(reserva) {
    const reservas = obtenerReservas();
    reservas.push(reserva);
    localStorage.setItem('reservas', JSON.stringify(reservas));
}

function mostrarReservas() {
    const reservas = obtenerReservas();
    const container = document.getElementById('reservas-guardadas');
    if (!container) return;

    if (reservas.length === 0) {
        container.innerHTML = '<p class="no-reservas">No tienes reservas aún</p>';
        return;
    }

    container.innerHTML = reservas.map((r, i) => `
        <div class="reserva-item">
            <strong>${r.nombre}</strong> - ${r.fecha} a las ${r.hora} - ${r.personas} persona(s)
            <button onclick="eliminarReserva(${i})" class="btn-eliminar">Eliminar</button>
        </div>
    `).join('');
}

function eliminarReserva(index) {
    const reservas = obtenerReservas();
    reservas.splice(index, 1);
    localStorage.setItem('reservas', JSON.stringify(reservas));
    mostrarReservas();
}

document.querySelector('.reservation-form').addEventListener('submit', function(e) {
    e.preventDefault();

    const nombre = document.getElementById('nombre').value;
    const email = document.getElementById('email').value;
    const fecha = document.getElementById('fecha').value;
    const hora = document.getElementById('hora').value;
    const personas = document.getElementById('personas').value;

    if (nombre && email && fecha && hora && personas) {
        const reserva = { nombre, email, fecha, hora, personas };
        guardarReserva(reserva);
        alert(`¡Reserva confirmada!\n\nNombre: ${nombre}\nFecha: ${fecha}\nHora: ${hora}\nPersonas: ${personas}\n\n¡Te esperamos!`);
        this.reset();
        mostrarReservas();
    }
});

document.addEventListener('DOMContentLoaded', mostrarReservas);

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});
