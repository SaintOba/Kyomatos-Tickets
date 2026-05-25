const container = document.querySelector('.container');
const registerBtn = document.querySelector('.register-btn');
const loginBtn = document.querySelector('.login-btn');

registerBtn.addEventListener('click', () => container.classList.add('active'));
loginBtn.addEventListener('click', () => container.classList.remove('active'));

// SIGNUP
const signupForm = document.getElementById('signupForm');
signupForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('signupUsername').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;

    if(localStorage.getItem(email)){
        document.getElementById('signupError').textContent = "User already exists!";
        return;
    }

    const user = { username, email, password };
    localStorage.setItem(email, JSON.stringify(user));
    alert("Registration successful! You can now login.");
    container.classList.remove('active'); // switch to login form
});

// LOGIN
const loginForm = document.getElementById('loginForm');
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const email = document.getElementById('loginUsername').value;
    const password = document.getElementById('loginPassword').value;

    const user = JSON.parse(localStorage.getItem(email));
    if(user && user.password === password){
        alert("Login successful!");
        // Save current user for other pages to read
        const currentUser = { username: user.username, email: user.email };
        localStorage.setItem('currentUser', JSON.stringify(currentUser));
        window.location.href = "index.html";
    } else {
        document.getElementById('loginError').textContent = "Invalid email or password";
    }
});
