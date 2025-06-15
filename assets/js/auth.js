// Authentication functions for BudgetWise

// Check if user is logged in
function isLoggedIn() {
    const user = getLocalStorage('currentUser');
    return user !== null;
}

// Get current user
function getCurrentUser() {
    return getLocalStorage('currentUser');
}

// Set current user
function setCurrentUser(user) {
    setLocalStorage('currentUser', user);
    updateNavigation();
}

// Clear current user
function clearCurrentUser() {
    removeLocalStorage('currentUser');
    updateNavigation();
}

// Update navigation based on auth status
function updateNavigation() {
    const user = getCurrentUser();
    const userMenu = document.getElementById('userMenu');
    const userName = document.getElementById('userName');
    const authButtons = document.getElementById('authButtons');
    const mainNav = document.getElementById('mainNav');
    
    if (user) {
        // User is logged in
        if (userMenu) userMenu.style.display = 'block';
        if (userName) userName.textContent = user.name;
        if (authButtons) authButtons.style.display = 'none';
        if (mainNav) mainNav.style.display = 'block';
    } else {
        // User is not logged in
        if (userMenu) userMenu.style.display = 'none';
        if (authButtons) authButtons.style.display = 'block';
        if (mainNav) mainNav.style.display = 'none';
    }
}

// Handle login
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const spinner = document.getElementById('loginSpinner');
    
    // Validation
    if (!email || !password) {
        showToast('Veuillez remplir tous les champs', 'error');
        return;
    }
    
    if (!isValidEmail(email)) {
        showToast('Veuillez entrer un email valide', 'error');
        return;
    }
    
    // Show loading
    if (spinner) spinner.classList.remove('d-none');
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`, {
            method: 'POST'
        });
        
        if (response.ok) {
            const data = await response.json();
            
            // Store user data
            setCurrentUser(data.user);
            
            showToast('Connexion réussie !', 'success');
            
            // Redirect to dashboard
            setTimeout(() => {
                window.location.href = 'dashboard.html';
            }, 1000);
        } else {
            const error = await response.json();
            showToast(error.detail || 'Erreur de connexion', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Erreur de connexion. Veuillez réessayer.', 'error');
    } finally {
        // Hide loading
        if (spinner) spinner.classList.add('d-none');
    }
}

// Handle registration
async function handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    const spinner = document.getElementById('registerSpinner');
    
    // Validation
    if (!name || !email || !password || !confirmPassword) {
        showToast('Veuillez remplir tous les champs', 'error');
        return;
    }
    
    if (!isValidEmail(email)) {
        showToast('Veuillez entrer un email valide', 'error');
        return;
    }
    
    if (!isValidPassword(password)) {
        showToast('Le mot de passe doit contenir au moins 6 caractères', 'error');
        return;
    }
    
    if (password !== confirmPassword) {
        showToast('Les mots de passe ne correspondent pas', 'error');
        return;
    }
    
    // Show loading
    if (spinner) spinner.classList.remove('d-none');
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: name,
                email: email,
                password: password
            })
        });
        
        if (response.ok) {
            showToast('Compte créé avec succès ! Redirection vers la connexion...', 'success');
            
            // Clear form
            document.getElementById('registerForm').reset();
            
            // Redirect to login page
            setTimeout(() => {
                window.location.href = `login.html?email=${encodeURIComponent(email)}`;
            }, 2000);
        } else {
            const error = await response.json();
            showToast(error.detail || 'Erreur lors de la création du compte', 'error');
        }
    } catch (error) {
        console.error('Register error:', error);
        showToast('Erreur lors de la création du compte. Veuillez réessayer.', 'error');
    } finally {
        // Hide loading
        if (spinner) spinner.classList.add('d-none');
    }
}

// Handle logout
function logout() {
    clearCurrentUser();
    showToast('Déconnexion réussie', 'info');
    
    // Redirect to home page
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 1000);
}

// Check authentication and redirect if needed
function requireAuth() {
    if (!isLoggedIn()) {
        showToast('Vous devez être connecté pour accéder à cette page', 'warning');
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 2000);
        return false;
    }
    return true;
}

// Initialize authentication on page load
function initAuth() {
    updateNavigation();
    
    // Pre-fill email from query params (for registration redirect)
    const params = getQueryParams();
    if (params.email) {
        const emailInput = document.getElementById('loginEmail');
        if (emailInput) {
            emailInput.value = params.email;
        }
    }
    
    // Check if on protected page
    const protectedPages = ['dashboard.html', 'transactions.html', 'budget.html', 'statistics.html'];
    const currentPage = window.location.pathname.split('/').pop();
    
    if (protectedPages.includes(currentPage)) {
        if (!requireAuth()) {
            return;
        }
        
        // Update user name in navigation
        const user = getCurrentUser();
        const userName = document.getElementById('userName');
        if (userName && user) {
            userName.textContent = user.name;
        }
    }
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', function() {
    initAuth();
});