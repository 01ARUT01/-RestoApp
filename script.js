document.querySelector('.reservation-form').addEventListener('submit', function(e) {
    e.preventDefault();

    const nombre = document.getElementById('nombre').value;
    const email = document.getElementById('email').value;
    const fecha = document.getElementById('fecha').value;
    const hora = document.getElementById('hora').value;
    const personas = document.getElementById('personas').value;

    if (nombre && email && fecha && hora && personas) {
        alert(`¡Reserva confirmada!\n\nNombre: ${nombre}\nFecha: ${fecha}\nHora: ${hora}\nPersonas: ${personas}\n\n¡Te esperamos!`);
        this.reset();
    }
});

document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function(e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({ behavior: 'smooth' });
        }
    });
});
