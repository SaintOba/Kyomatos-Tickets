document.addEventListener('DOMContentLoaded', function() {
    const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
    const eventList = document.getElementById('eventList');
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));

    // Update nav based on login status
    updateNavigation();

    let events = [];
    const CACHE_KEY = 'kyoEventsCache';

    function readCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || []; } catch (e) { return []; } }

    async function loadEvents() {
        eventList.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#9a9a9a;padding:2rem">Loading events...</p>';
        try {
            const r = await fetch(`${API_CONFIG.baseURL}/api/events`);
            const d = await r.json();
            if (!d.success) throw new Error('bad response');
            events = d.events;
            try { localStorage.setItem(CACHE_KEY, JSON.stringify(events)); } catch (e) {}
        } catch (e) {
            events = readCache(); // server asleep or offline: show the last events we saw
            if (!events.length) {
                eventList.innerHTML = '<p style="grid-column:1/-1;text-align:center;color:#9a9a9a;padding:2rem">Events are taking a moment to load. Please refresh in a few seconds.</p>';
                return;
            }
        }
        applySearch();
    }

    function renderEvents(data) {
        eventList.innerHTML = '';
        data.forEach(e => {
            const card = document.createElement('div');
            card.className = 'event-card';
            card.innerHTML = `
              ${e.image ? `<img src="${esc(e.image)}" alt="${esc(e.title)}" class="event-image"/>` : ''}
              <h4>${esc(e.title)}</h4>
              <p>📅 ${esc(e.date)}</p>
              <p>🕒 ${esc(e.time)}</p>
              <p>📍 ${esc(e.location)}</p>
              <p><strong>₦${Number(e.price).toLocaleString()}</strong>${e.soldOut ? ' · <span style="color:#E8200C">SOLD OUT</span>' : ''}</p>
              <button class="details-btn">View Details</button>
            `;

            // Card click to details
            card.querySelector('.details-btn').addEventListener('click', () => {
                window.location.href = `about.html?id=${e.id}`;
            });

            eventList.appendChild(card);
        });
    }

    function applySearch() {
        const query = document.getElementById('search').value.toLowerCase();
        renderEvents(events.filter(ev => ev.title.toLowerCase().includes(query)));
    }
    document.getElementById('search').addEventListener('input', applySearch);

    loadEvents();

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