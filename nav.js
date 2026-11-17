// Shared header behaviour: shows Login/Sign Up or the user menu depending on login state.
window.KyoNav = {
  refresh() {
    let user = null;
    try { user = JSON.parse(localStorage.getItem('currentUser')); } catch (e) {}
    const authButtons = document.getElementById('authButtons');
    const userMenu = document.getElementById('userMenu');
    const avatar = document.getElementById('userAvatar');
    if (!authButtons || !userMenu) return;
    if (user && user.email) {
      authButtons.style.display = 'none';
      userMenu.style.display = 'flex';
      if (avatar) {
        const name = (user.name || user.username || user.email).trim();
        avatar.textContent = name.split(/\s+/).map(n => n[0]).slice(0, 2).join('').toUpperCase();
        avatar.title = user.email;
      }
    } else {
      authButtons.style.display = '';
      userMenu.style.display = 'none';
    }
  }
};
document.addEventListener('DOMContentLoaded', () => KyoNav.refresh());
