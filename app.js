document.addEventListener('DOMContentLoaded', function() {
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const eventList = document.getElementById('eventList');
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));

    // Update nav based on login status
    updateNavigation();

    const events = [
      { id: 1, title: 'Tech Conference 2025', date: 'July 25, 2025', time: '02:00 PM - 06:00 PM WAT', location: 'Lagos Convention Center', price: 3000, image: 'images/tech.jpg' },
      { id: 2, title: 'Music Festival', date: 'August 10, 2025', time: '09:00 PM - 04:00 AM WAT', location: 'Eko Atlantic', price: 5000, image: 'images/festiival.jpg' },
      { id: 3, title: 'Art Exhibition', date: 'September 5, 2025', time: '12:00 PM - 04:00 PM WAT', location: 'Downtown Gallery', price: 2500, image: 'images/art.jpg' },
      { id: 4, title: 'Afro Six6 House Party', date: 'December 5, 2025', time: '09:00 PM - Till Dawn WAT', location: '17 Jossy Empire', price: 15000, image: 'images/afro6.jpg' },
      { id: 5, title: 'Pool Party', date: 'August 25, 2025', time: '04:00 PM - 12:00 PM WAT', location: 'Lagos Island', price: 7500, image: 'images/poolparty.jpg' },
      { id: 6, title: 'BNB House Party', date: 'September 5, 2025', time: '09:00 PM - 04:00 AM WAT', location: '123 Main Street, Victoria Island', price: 10000, image: 'images/kickback.jpg' }
    ];

    function renderEvents(data) {
        eventList.innerHTML = '';
        data.forEach(e => {
            const card = document.createElement('div');
            card.className = 'event-card';
            card.innerHTML = `
              <img src="${e.image}" alt="${e.title}" class="event-image"/>
              <h4>${e.title}</h4>
              <p>📅 ${e.date}</p>
              <p>🕒 ${e.time}</p>
              <p>📍 ${e.location}</p>
              <p><strong>₦${e.price.toLocaleString()}</strong></p>
              <button class="details-btn">View Details</button>
            `;

            // Card click to details
            card.querySelector('.details-btn').addEventListener('click', () => {
                window.location.href = `about.html?id=${e.id}`;
            });

            eventList.appendChild(card);
        });
    }

    document.getElementById('search').addEventListener('input', e => {
        const query = e.target.value.toLowerCase();
        const filtered = events.filter(ev => ev.title.toLowerCase().includes(query));
        renderEvents(filtered);
    });

    renderEvents(events);

    function updateNavigation() {
    if (window.KyoNav) KyoNav.refresh();
}

    // Make logout function globally available
    window.logout = function() {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('jwt_token');
        localStorage.removeItem('userTickets');
        window.location.href = 'index.html';
    };
});