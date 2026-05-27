const tickets = {
    1: {
        id: 1,
        title: 'Tech Conference 2025',
        date: 'July 25, 2025',
        time: '02:00 PM - 06:00 PM WAT',
        location: 'Lagos Convention Center',
        price: 3000,
        description: 'Join the biggest tech conference of 2025 with industry leaders, workshop, and networking opportunities.',
        image: 'images/tech.jpg',
        ticketType: 'VIP'
    },
            2: {
        id: 2,
        title: 'Music Festival',
        date: '2025-08-10',
        time: '09:00 PM - 04:00 AM WAT',
        location: 'Eko Atlantic',
        venue: 'Eko Atlantic',
        venueAddress: 'Eko Atlantic City, Lagos',
        price: 5000,
        description: 'Experience live performances from top artist at the annual music festival',
        image: 'images/festiival.jpg',
        category: 'concert',
        ticketType: 'premium'
    },
    3: {
        id: 3,
        title: 'Art Exhibition',
        date: '2025-09-05',
        time: '12:00 PM - 04:00 PM WAT',
        location: 'Downtown Gallery',
        venue: 'Downtown Gallery',
        venueAddress: 'Lekki Phase 1, Lagos',
        price: 2500,
        description: 'Explore contemporary art from local to international artists',
        image: 'images/art.jpg',
        category: 'theater',
        ticketType: 'standard'
    },
    4: {
        id: 4,
        title: 'Afro Six6 House Party',
        date: '2025-12-05',
        time: '09:00 PM - Till Dawn WAT',
        location: '17 Jossy Empire',
        venue: '17 Jossy Empire',
        venueAddress: 'Ikeja, Lagos',
        price: 15000,
        description: 'Exclusive Afrobeat party with top DJs and artists',
        image: 'images/afro6.jpg',
        category: 'concert',
        ticketType: 'vip'
    },
    5: {
        id: 5,
        title: 'Pool Party',
        date: '2025-08-25',
        time: '04:00 PM - 12:00 PM WAT',
        location: 'Lagos Island',
        venue: 'Lagos Island Resort',
        venueAddress: 'Lagos Island, Lagos',
        price: 7500,
        description: 'Summer pool party with music, drinks, and entertainment',
        image: 'images/poolparty.jpg',
        category: 'other',
        ticketType: 'standard'
    },  
    6: {  
        id: 6,
        title: 'BNB House Party',
        date: '2025-09-05',
        time: '09:00 PM - 04:00 AM WAT',
        location: '123 Main Street, Victoria Island',
        venue: 'Victoria Island Penthouse',
        venueAddress: '123 Main Street, Victoria Island, Lagos',
        price: 10000,
        description: 'Exclusive house party with premium amenities',
        image: 'images/kickback.jpg',
        category: 'other',
        ticketType: 'premium'
    }
};

// Get ID from URL
function getTicketIdFromUrl() {
    return new URLSearchParams(window.location.search).get('id');
}

function updateNavigation() {
    const currentUser = JSON.parse(localStorage.getItem('currentUser'));
    const nav = document.querySelector('nav ul');
    if (currentUser) {
        nav.innerHTML = `
            <li><a href="index.html">Home</a></li>
            <li><a href="index.html#events">Events</a></li>
            <li><a href="my-tickets.html">My Tickets</a></li>
            <li><a href="#contact">Contact</a></li>
            <li><span style="color: #2563eb; font-weight: 600;">${currentUser.email}</span></li>
            <button onclick="logout()">Logout</button>
        `;
    } else {
        nav.innerHTML = `
            <li><a href="index.html">Home</a></li>
            <li><a href="index.html#events">Events</a></li>
            <li><a href="#contact">Contact</a></li>
            <button id="loginBtn" onclick="window.location.href='login.html'">Login</button>
            <button class="primary" id="signupBtn" onclick="window.location.href='login.html'">Sign Up</button>
        `;
    }
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
        const amount = ticket.price * quantity * 100; // Convert to kobo
        
        const response = await fetch(`${API_CONFIG.baseURL}/api/pay/initialize`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                email: userInfo.email,
                amount: ticket.price * quantity,
                eventId: ticket.id,
                quantity: quantity,
                frontendUrl: window.location.origin,
                metadata: {
                    eventTitle: ticket.title,
                    eventDate: ticket.date,
                    eventTime: ticket.time,
                    eventLocation: ticket.location,
                    ticketType: ticket.ticketType,
                    attendeeName: userInfo.name,
                    attendeePhone: userInfo.phone,
                    paymentReference: `KYO-${Date.now()}`
                }
            })
        });
        
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
        const response = await fetch(`${API_CONFIG.baseURL}/api/pay/verify?reference=${reference}`);
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

function showTicketDetails() {
    const ticketId = getTicketIdFromUrl();
    const ticket = tickets[ticketId];

    if (ticket) {
        document.getElementById('ticketDetail').innerHTML = `
            <div class="ticket-header">
                <h1>${ticket.title}</h1>
                <div class="ticket-badge">${ticket.ticketType}</div>
            </div>
            
            <img src="${ticket.image}" alt="${ticket.title}" class="ticket-image">
            
            <div class="ticket-info-card">
                <h3>About this event</h3>
                <p>${ticket.description}</p>
                
                <div class="ticket-details">
                    <div class="detail-item">
                        <i class='bx bx-calendar'></i>
                        <span>${ticket.date}</span>
                    </div>
                    <div class="detail-item">
                        <i class='bx bx-time'></i>
                        <span>${ticket.time}</span>
                    </div>
                    <div class="detail-item">
                        <i class='bx bx-map'></i>
                        <span>${ticket.location}</span>
                    </div>
                    <div class="detail-item">
                        <i class='bx bx-category'></i>
                        <span>${ticket.ticketType} Pass</span>
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
                    
                    <div class="total-price">
                        <span>Total:</span>
                        <span id="total" class="total-amount">₦${ticket.price.toLocaleString()}</span>
                    </div>
                </div>
                
                <button id="buyBtn" class="paystack-btn">
                    <i class='bx bx-credit-card'></i>
                    Buy Ticket with Paystack
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

        document.getElementById('increase').addEventListener('click', () => {
            quantity++;
            updateQuantity(quantity);
        });

        document.getElementById('decrease').addEventListener('click', () => {
            if (quantity > 1) quantity--;
            updateQuantity(quantity);
        });

        document.getElementById('buyBtn').addEventListener('click', async () => {
            await handlePayment(ticket, quantity);
        });

        function updateQuantity(qty) {
            quantityEl.textContent = qty;
            totalEl.textContent = `₦${(ticket.price * qty).toLocaleString()}`;
        }

    } else {
        document.getElementById("ticketDetail").innerHTML = `
            <div class="error-state">
                <i class='bx bx-error-circle'></i>
                <h2>Ticket Not Found</h2>
                <p>The requested ticket could not be found.</p>
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
                <p>${result?.message || 'Unable to initialize payment'}</p>
            </div>
        `;
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
                // Store tickets if they exist
                if (result.tickets && result.tickets.length > 0) {
                    console.log('Storing tickets:', result.tickets);
                    const userTickets = JSON.parse(localStorage.getItem('userTickets') || '[]');
                    userTickets.push(...result.tickets);
                    localStorage.setItem('userTickets', JSON.stringify(userTickets));
                    
                    // Redirect to tickets page
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
        const response = await fetch(`${API_CONFIG.baseURL}/api/tickets/download/${ticket.ticketId}`);
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `kyomatos_ticket_${ticket.ticketId}.pdf`;
            document.body.appendChild(a);
            a.click();
            window.URL.revokeObjectURL(url);
            document.body.removeChild(a);
        }
    }
}

showTicketDetails();
