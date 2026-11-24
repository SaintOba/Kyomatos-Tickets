// Events come from the backend (managed in the admin page)
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function fetchEvent(id) {
    try {
        const r = await fetch(`${API_CONFIG.baseURL}/api/events/${encodeURIComponent(id)}`);
        if (r.status === 404) return { event: null };
        const d = await r.json();
        if (d.success) return { event: d.event };
    } catch (e) {}
    return { error: true };
}

// Get ID from URL
function getTicketIdFromUrl() {
    return new URLSearchParams(window.location.search).get('id');
}

function updateNavigation() {
    if (window.KyoNav) KyoNav.refresh();
}

// Call navigation updater and render ticket on page load
document.addEventListener('DOMContentLoaded', () => {
    updateNavigation();
    showTicketDetails();

    const menuToggle = document.getElementById('menuToggle');
    const navMenu = document.getElementById('navMenu');
    if (menuToggle && navMenu) {
        menuToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
            menuToggle.textContent = navMenu.classList.contains('active') ? '✕' : '☰';
        });

        document.addEventListener('click', (e) => {
            if (!navMenu.contains(e.target) && !menuToggle.contains(e.target)) {
                navMenu.classList.remove('active');
                menuToggle.textContent = '☰';
            }
        });
    }
});

// Initialize Paystack payment
async function initializePayment(ticket, quantity, userInfo) {
    try {
        const response = await fetch(`${API_CONFIG.baseURL}/api/pay/initialize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...API_CONFIG.authHeaders()
            },
            // Only the event and quantity are sent. The server decides price, buyer and details.
            body: JSON.stringify({
                eventId: ticket.id,
                quantity: quantity
            })
        });

        if (response.status === 401) {
            API_CONFIG.forceLogin();
            return { success: false, message: 'Please log in again' };
        }

        const data = await response.json();
        
        if (data.success) {
            // Redirect to Paystack payment page
            window.location.href = data.data.authorization_url;
            return data;
        } else {
            throw new Error(data.message || 'Payment initialization failed');
        }
    } catch (error) {
        console.error('Payment error:', error);
        return {
            success: false,
            message: error.message
        };
    }
}

// Verify payment after callback
async function verifyPayment(reference) {
    try {
        const response = await fetch(`${API_CONFIG.baseURL}/api/pay/verify?reference=${encodeURIComponent(reference)}`, {
            headers: API_CONFIG.authHeaders()
        });
        if (response.status === 401) {
            API_CONFIG.forceLogin();
            return { success: false, message: 'Please log in again' };
        }
        const data = await response.json();
        console.log('Payment verification response:', data);
        return data;
    } catch (error) {
        console.error('Payment verification error:', error);
        return {
            success: false,
            message: 'Payment verification failed'
        };
    }
}

async function showTicketDetails() {
    const ticketId = getTicketIdFromUrl();
    const box = document.getElementById('ticketDetail');
    box.innerHTML = '<p style="text-align:center;padding:3rem;color:#9a9a9a">Loading event...</p>';
    const { event: ticket, error } = await fetchEvent(ticketId);

    if (error) {
        box.innerHTML = `
            <div class="error-state">
                <h2>Can't reach the server</h2>
                <p>It may be waking up. Please wait a few seconds and try again.</p>
                <a href="about.html?id=${esc(ticketId)}" class="back-link">Try again</a>
            </div>`;
        return;
    }

    if (ticket) {
        document.getElementById('ticketDetail').innerHTML = `
            <div class="ticket-header">
                <h1>${esc(ticket.title)}</h1>
                <div class="ticket-badge">${esc(ticket.ticketType)}</div>
            </div>
            
            ${ticket.image ? `<img src="${esc(ticket.image)}" alt="${esc(ticket.title)}" class="ticket-image">` : ''}
            
            <div class="ticket-info-card">
                <h3>About this event</h3>
                <p>${esc(ticket.description)}</p>
                
                <div class="ticket-details">
                    <div class="detail-item">
                        <i class='bx bx-calendar'></i>
                        <span>${esc(ticket.date)}</span>
                    </div>
                    <div class="detail-item">
                        <i class='bx bx-time'></i>
                        <span>${esc(ticket.time)}</span>
                    </div>
                    <div class="detail-item">
                        <i class='bx bx-map'></i>
                        <span>${esc(ticket.location)}</span>
                    </div>
                    <div class="detail-item">
                        <i class='bx bx-category'></i>
                        <span>${esc(ticket.ticketType)} Pass</span>
                    </div>
                </div>
                
                <div class="pricing-section">
                    <div class="price-display">
                        <span class="price-label">Price per ticket:</span>
                        <span class="price">₦${ticket.price.toLocaleString()}</span>
                    </div>
                    
                    <div class="quantity-selector">
                        <button id="decrease" class="qty-btn">
                            <i class='bx bx-minus'></i>
                        </button>
                        <span id="quantity" class="qty-display">1</span>
                        <button id="increase" class="qty-btn">
                            <i class='bx bx-plus'></i>
                        </button>
                    </div>
                    
                    <div id="feeNote" class="muted" style="font-size:.85rem;color:#aaa;text-align:right;margin-bottom:.4rem"></div>
                    <div class="total-price">
                        <span>Total:</span>
                        <span id="total" class="total-amount">₦${ticket.price.toLocaleString()}</span>
                    </div>
                </div>
                
                <button id="buyBtn" class="paystack-btn" ${ticket.soldOut ? 'disabled style="opacity:.5;cursor:not-allowed"' : ''}>
                    <i class='bx bx-credit-card'></i>
                    ${ticket.soldOut ? 'Sold out' : 'Buy Ticket with Paystack'}
                </button>
                
                <div id="paymentStatus"></div>
                
                <div class="payment-methods">
                    <p>Secure payment powered by <strong>Paystack</strong></p>
                </div>
            </div>
            
            <a href="index.html" class="back-link">
                <i class='bx bx-arrow-back'></i>
                Back to Events
            </a>
        `;

        let quantity = 1;
        const quantityEl = document.getElementById('quantity');
        const totalEl = document.getElementById('total');
        const feeEl = document.getElementById('feeNote');
        let feeSeq = 0;

        document.getElementById('increase').addEventListener('click', () => {
            if (quantity < 10) quantity++;
            updateQuantity(quantity);
        });

        document.getElementById('decrease').addEventListener('click', () => {
            if (quantity > 1) quantity--;
            updateQuantity(quantity);
        });

        document.getElementById('buyBtn').addEventListener('click', async () => {
            if (ticket.soldOut) return;
            await handlePayment(ticket, quantity);
        });

        async function updateQuantity(qty) {
            quantityEl.textContent = qty;
            const sub = ticket.price * qty;
            totalEl.textContent = `₦${sub.toLocaleString()}`;
            const seq = ++feeSeq;
            try {
                const r = await fetch(`${API_CONFIG.baseURL}/api/fee-quote?eventId=${encodeURIComponent(ticket.id)}&quantity=${qty}`);
                const q = await r.json();
                if (seq !== feeSeq || !q.success) return;
                feeEl.textContent = q.fee > 0 ? `Service fee (₦${q.feePerTicket.toLocaleString()} per ticket): ₦${q.fee.toLocaleString()}` : '';
                totalEl.textContent = `₦${q.total.toLocaleString()}`;
            } catch (e) { /* keep subtotal display */ }
        }
        updateQuantity(1);

    } else {
        document.getElementById("ticketDetail").innerHTML = `
            <div class="error-state">
                <i class='bx bx-error-circle'></i>
                <h2>Event not found</h2>
                <p>This event is no longer on sale.</p>
                <a href="index.html" class="back-link">Back to Events</a>
            </div>
        `;
    }
}

async function handlePayment(ticket, quantity) {
    const statusEl = document.getElementById('paymentStatus');
    
    // Check if user is logged in
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    if (!currentUser) {
        alert('Please login or sign up to purchase tickets');
        window.location.href = 'login.html';
        return;
    }
    
    // Update status
    statusEl.innerHTML = `
        <div class="processing-payment">
            <div class="spinner"></div>
            <p>Initializing Paystack payment...</p>
        </div>
    `;
    
    // Initialize payment
    const result = await initializePayment(ticket, quantity, {
        name: currentUser.name || currentUser.email,
        email: currentUser.email,
        phone: currentUser.phone || ''
    });
    
    if (!result || result.success === false) {
        statusEl.innerHTML = `
            <div class="payment-error">
                <i class='bx bx-error'></i>
                <p></p>
            </div>
        `;
        statusEl.querySelector('p').textContent = result?.message || 'Unable to initialize payment';
    }
}

// Check for payment callback
window.addEventListener('load', () => {
    const urlParams = new URLSearchParams(window.location.search);
    const reference = urlParams.get('reference');
    const trxref = urlParams.get('trxref');
    
    if (reference || trxref) {
        const paymentRef = reference || trxref;
        console.log('Payment reference found:', paymentRef);
        
        verifyPayment(paymentRef).then(result => {
            console.log('Verification result:', result);
            
            if (result.success) {
                // Tickets live on the server; My Tickets loads them from there
                if (result.tickets && result.tickets.length > 0) {
                    setTimeout(() => {
                        window.location.href = 'my-tickets.html?payment=success';
                    }, 1000);
                } else {
                    console.log('No tickets in response');
                    alert('Payment successful! Your tickets will be available shortly.');
                    setTimeout(() => {
                        window.location.href = 'my-tickets.html?payment=success';
                    }, 2000);
                }
            } else {
                console.error('Payment verification failed:', result.message);
                alert('Payment verification failed: ' + (result.message || 'Unknown error'));
            }
        }).catch(error => {
            console.error('Payment verification error:', error);
            alert('Error verifying payment. Please contact support.');
        });
    }
});

async function downloadAllTickets(tickets) {
    for (const ticket of tickets) {
        await API_CONFIG.downloadTicket(ticket.ticketId);
    }
}