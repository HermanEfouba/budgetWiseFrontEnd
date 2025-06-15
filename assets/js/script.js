// Global variables
let currentUser = null;
let expenseChart = null;

// API Base URL
const API_BASE_URL = "https://budgetwise-m0r3.onrender.com" || 'http://localhost:8000';

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeApp();
    setupEventListeners();
    checkAuthStatus();
});

// Initialize application
function initializeApp() {
    // Set current date for date inputs
    const today = new Date().toISOString().split('T')[0];
    const currentMonth = new Date().toISOString().slice(0, 7);
    
    const revenueDate = document.getElementById('revenueDate');
    const expenseDate = document.getElementById('expenseDate');
    const budgetMonth = document.getElementById('budgetMonth');
    
    if (revenueDate) revenueDate.value = today;
    if (expenseDate) expenseDate.value = today;
    if (budgetMonth) budgetMonth.value = currentMonth;
    
    // Load categories
    loadCategories();
}

// Setup event listeners
function setupEventListeners() {
    // Login form
    const loginForm = document.getElementById('loginForm');
    if (loginForm) {
        loginForm.addEventListener('submit', handleLogin);
    }
    
    // Register form
    const registerForm = document.getElementById('registerForm');
    if (registerForm) {
        registerForm.addEventListener('submit', handleRegister);
    }
    
    // Add revenue form
    const addRevenueForm = document.getElementById('addRevenueForm');
    if (addRevenueForm) {
        addRevenueForm.addEventListener('submit', handleAddRevenue);
    }
    
    // Add expense form
    const addExpenseForm = document.getElementById('addExpenseForm');
    if (addExpenseForm) {
        addExpenseForm.addEventListener('submit', handleAddExpense);
    }
    
    // Set budget form
    const setBudgetForm = document.getElementById('setBudgetForm');
    if (setBudgetForm) {
        setBudgetForm.addEventListener('submit', handleSetBudget);
    }
}

// Check authentication status
function checkAuthStatus() {
    const user = localStorage.getItem('currentUser');
    
    if (user) {
        currentUser = JSON.parse(user);
        showDashboard();
        loadDashboardData();
    } else {
        showAuthSection();
    }
}

// Authentication functions
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/login?email=${encodeURIComponent(email)}&password=${encodeURIComponent(password)}`, {
            method: 'POST'
        });
        
        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            
            localStorage.setItem('currentUser', JSON.stringify(currentUser));
            
            showDashboard();
            loadDashboardData();
            showToast('Connexion réussie !', 'success');
        } else {
            const error = await response.json();
            showToast(error.detail || 'Erreur de connexion', 'error');
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Erreur de connexion', 'error');
    } finally {
        showLoading(false);
    }
}

async function handleRegister(e) {
    e.preventDefault();
    
    const name = document.getElementById('registerName').value;
    const email = document.getElementById('registerEmail').value;
    const password = document.getElementById('registerPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;
    
    if (password !== confirmPassword) {
        showToast('Les mots de passe ne correspondent pas', 'error');
        return;
    }
    
    showLoading(true);
    
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
            showToast('Compte créé avec succès ! Vous pouvez maintenant vous connecter.', 'success');
            bootstrap.Modal.getInstance(document.getElementById('registerModal')).hide();
            document.getElementById('loginEmail').value = email;
        } else {
            const error = await response.json();
            showToast(error.detail || 'Erreur lors de la création du compte', 'error');
        }
    } catch (error) {
        console.error('Register error:', error);
        showToast('Erreur lors de la création du compte', 'error');
    } finally {
        showLoading(false);
    }
}

function logout() {
    localStorage.removeItem('currentUser');
    currentUser = null;
    showAuthSection();
    showToast('Déconnexion réussie', 'info');
}

// UI functions
function showAuthSection() {
    const authSection = document.getElementById('authSection');
    const dashboardSection = document.getElementById('dashboardSection');
    const loginBtn = document.getElementById('loginBtn');
    const userMenu = document.getElementById('userMenu');
    
    if (authSection) authSection.style.display = 'block';
    if (dashboardSection) dashboardSection.style.display = 'none';
    if (loginBtn) loginBtn.style.display = 'block';
    if (userMenu) userMenu.style.display = 'none';
}

function showDashboard() {
    const authSection = document.getElementById('authSection');
    const dashboardSection = document.getElementById('dashboardSection');
    const loginBtn = document.getElementById('loginBtn');
    const userMenu = document.getElementById('userMenu');
    const userName = document.getElementById('userName');
    
    if (authSection) authSection.style.display = 'none';
    if (dashboardSection) dashboardSection.style.display = 'block';
    if (loginBtn) loginBtn.style.display = 'none';
    if (userMenu) userMenu.style.display = 'block';
    if (userName && currentUser) userName.textContent = currentUser.name;
}

function showRegisterForm() {
    const registerModal = new bootstrap.Modal(document.getElementById('registerModal'));
    registerModal.show();
}

// Modal functions
function showAddRevenueModal() {
    const modal = new bootstrap.Modal(document.getElementById('addRevenueModal'));
    modal.show();
}

function showAddExpenseModal() {
    const modal = new bootstrap.Modal(document.getElementById('addExpenseModal'));
    modal.show();
}

function showSetBudgetModal() {
    const modal = new bootstrap.Modal(document.getElementById('setBudgetModal'));
    modal.show();
}

// Data loading functions
async function loadDashboardData() {
    if (!currentUser) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/budgets/dashboard?user_id=${currentUser.id}`);
        
        if (response.ok) {
            const data = await response.json();
            updateDashboardStats(data);
            loadRecentTransactions();
            updateExpenseChart(data.top_categories);
        }
    } catch (error) {
        console.error('Error loading dashboard data:', error);
    }
}

function updateDashboardStats(data) {
    const currentBalance = document.getElementById('currentBalance');
    const monthlyRevenue = document.getElementById('monthlyRevenue');
    const monthlyExpenses = document.getElementById('monthlyExpenses');
    const budgetRemaining = document.getElementById('budgetRemaining');
    
    if (currentBalance) currentBalance.textContent = `€${data.current_balance.toFixed(2)}`;
    if (monthlyRevenue) monthlyRevenue.textContent = `€${data.total_revenue_this_month.toFixed(2)}`;
    if (monthlyExpenses) monthlyExpenses.textContent = `€${data.total_expenses_this_month.toFixed(2)}`;
    if (budgetRemaining) budgetRemaining.textContent = `€${data.budget_remaining.toFixed(2)}`;
}

async function loadRecentTransactions() {
    if (!currentUser) return;
    
    try {
        // Load recent expenses
        const expensesResponse = await fetch(`${API_BASE_URL}/expenses?user_id=${currentUser.id}&limit=5`);
        
        // Load recent revenues
        const revenuesResponse = await fetch(`${API_BASE_URL}/revenues?user_id=${currentUser.id}&limit=5`);
        
        if (expensesResponse.ok && revenuesResponse.ok) {
            const expenses = await expensesResponse.json();
            const revenues = await revenuesResponse.json();
            
            displayRecentTransactions([...expenses, ...revenues]);
        }
    } catch (error) {
        console.error('Error loading recent transactions:', error);
    }
}

function displayRecentTransactions(transactions) {
    const container = document.getElementById('recentTransactions');
    if (!container) return;
    
    container.innerHTML = '';
    
    // Sort by date (most recent first)
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    transactions.slice(0, 5).forEach(transaction => {
        const isExpense = transaction.hasOwnProperty('description');
        const item = document.createElement('div');
        item.className = 'list-group-item d-flex justify-content-between align-items-center';
        
        item.innerHTML = `
            <div>
                <div class="fw-medium">${isExpense ? transaction.description : transaction.source}</div>
                <small class="text-muted">${new Date(transaction.date).toLocaleDateString('fr-FR')}</small>
            </div>
            <span class="badge ${isExpense ? 'bg-danger' : 'bg-success'} rounded-pill">
                ${isExpense ? '-' : '+'}€${transaction.amount.toFixed(2)}
            </span>
        `;
        
        container.appendChild(item);
    });
}

async function loadCategories() {
    try {
        const response = await fetch(`${API_BASE_URL}/categories`);
        
        if (response.ok) {
            const categories = await response.json();
            const select = document.getElementById('expenseCategory');
            
            if (select) {
                select.innerHTML = '<option value="">Sélectionner une catégorie</option>';
                categories.forEach(category => {
                    const option = document.createElement('option');
                    option.value = category.id;
                    option.textContent = category.name;
                    select.appendChild(option);
                });
            }
        }
    } catch (error) {
        console.error('Error loading categories:', error);
    }
}

async function loadTransactions() {
    const transactionsSection = document.getElementById('transactionsSection');
    if (transactionsSection) {
        transactionsSection.style.display = transactionsSection.style.display === 'none' ? 'block' : 'none';
    }
    
    if (!currentUser) return;
    
    try {
        const expensesResponse = await fetch(`${API_BASE_URL}/expenses?user_id=${currentUser.id}`);
        const revenuesResponse = await fetch(`${API_BASE_URL}/revenues?user_id=${currentUser.id}`);
        
        if (expensesResponse.ok && revenuesResponse.ok) {
            const expenses = await expensesResponse.json();
            const revenues = await revenuesResponse.json();
            
            displayAllTransactions([...expenses, ...revenues]);
        }
    } catch (error) {
        console.error('Error loading transactions:', error);
    }
}

function displayAllTransactions(transactions) {
    const tableBody = document.getElementById('transactionsTable');
    if (!tableBody) return;
    
    tableBody.innerHTML = '';
    
    // Sort by date (most recent first)
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    transactions.forEach(transaction => {
        const isExpense = transaction.hasOwnProperty('description');
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${new Date(transaction.date).toLocaleDateString('fr-FR')}</td>
            <td>${isExpense ? transaction.description : transaction.source}</td>
            <td>${isExpense && transaction.category ? transaction.category.name : 'Revenu'}</td>
            <td>${isExpense ? transaction.type : 'Revenu'}</td>
            <td class="${isExpense ? 'text-danger' : 'text-success'}">
                ${isExpense ? '-' : '+'}€${transaction.amount.toFixed(2)}
            </td>
            <td>
                <button class="btn btn-sm btn-outline-primary" onclick="editTransaction(${transaction.id}, '${isExpense ? 'expense' : 'revenue'}')">
                    Modifier
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteTransaction(${transaction.id}, '${isExpense ? 'expense' : 'revenue'}')">
                    Supprimer
                </button>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Chart functions
function updateExpenseChart(categoryData) {
    const ctx = document.getElementById('expenseChart');
    if (!ctx) return;
    
    if (expenseChart) {
        expenseChart.destroy();
    }
    
    const labels = categoryData.map(item => item.category_name);
    const data = categoryData.map(item => item.total_amount);
    const colors = [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
        '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
    ];
    
    expenseChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors.slice(0, data.length),
                borderWidth: 2,
                borderColor: '#fff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        padding: 20,
                        usePointStyle: true
                    }
                }
            }
        }
    });
}

// Form handlers
async function handleAddRevenue(e) {
    e.preventDefault();
    
    const amount = parseFloat(document.getElementById('revenueAmount').value);
    const source = document.getElementById('revenueSource').value;
    const date = document.getElementById('revenueDate').value;
    
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/revenues/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: amount,
                source: source,
                date: date,
                user_id: currentUser.id
            })
        });
        
        if (response.ok) {
            showToast('Revenu ajouté avec succès !', 'success');
            bootstrap.Modal.getInstance(document.getElementById('addRevenueModal')).hide();
            document.getElementById('addRevenueForm').reset();
            loadDashboardData();
        } else {
            const error = await response.json();
            showToast(error.detail || 'Erreur lors de l\'ajout du revenu', 'error');
        }
    } catch (error) {
        console.error('Error adding revenue:', error);
        showToast('Erreur lors de l\'ajout du revenu', 'error');
    } finally {
        showLoading(false);
    }
}

async function handleAddExpense(e) {
    e.preventDefault();
    
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const description = document.getElementById('expenseDescription').value;
    const categoryId = parseInt(document.getElementById('expenseCategory').value);
    const type = document.getElementById('expenseType').value;
    const date = document.getElementById('expenseDate').value;
    
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/expenses/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                amount: amount,
                description: description,
                category_id: categoryId,
                type: type,
                date: date,
                user_id: currentUser.id
            })
        });
        
        if (response.ok) {
            showToast('Dépense ajoutée avec succès !', 'success');
            bootstrap.Modal.getInstance(document.getElementById('addExpenseModal')).hide();
            document.getElementById('addExpenseForm').reset();
            loadDashboardData();
        } else {
            const error = await response.json();
            showToast(error.detail || 'Erreur lors de l\'ajout de la dépense', 'error');
        }
    } catch (error) {
        console.error('Error adding expense:', error);
        showToast('Erreur lors de l\'ajout de la dépense', 'error');
    } finally {
        showLoading(false);
    }
}

async function handleSetBudget(e) {
    e.preventDefault();
    
    const month = document.getElementById('budgetMonth').value;
    const amount = parseFloat(document.getElementById('budgetAmount').value);
    
    showLoading(true);
    
    try {
        const response = await fetch(`${API_BASE_URL}/budgets/`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                month: month,
                amount: amount,
                user_id: currentUser.id
            })
        });
        
        if (response.ok) {
            showToast('Budget défini avec succès !', 'success');
            bootstrap.Modal.getInstance(document.getElementById('setBudgetModal')).hide();
            document.getElementById('setBudgetForm').reset();
            loadDashboardData();
        } else {
            const error = await response.json();
            showToast(error.detail || 'Erreur lors de la définition du budget', 'error');
        }
    } catch (error) {
        console.error('Error setting budget:', error);
        showToast('Erreur lors de la définition du budget', 'error');
    } finally {
        showLoading(false);
    }
}

// Transaction management
async function editTransaction(id, type) {
    // Implement edit functionality
    showToast('Fonctionnalité de modification en cours de développement', 'info');
}

async function deleteTransaction(id, type) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette transaction ?')) {
        return;
    }
    
    try {
        const endpoint = type === 'expense' ? 'expenses' : 'revenues';
        const response = await fetch(`${API_BASE_URL}/${endpoint}/${id}`, {
            method: 'DELETE'
        });
        
        if (response.ok) {
            showToast('Transaction supprimée avec succès !', 'success');
            loadDashboardData();
            loadTransactions();
        } else {
            showToast('Erreur lors de la suppression', 'error');
        }
    } catch (error) {
        console.error('Error deleting transaction:', error);
        showToast('Erreur lors de la suppression', 'error');
    }
}

// Utility functions
function showLoading(show) {
    const spinner = document.getElementById('loadingSpinner');
    if (spinner) {
        if (show) {
            spinner.classList.remove('d-none');
        } else {
            spinner.classList.add('d-none');
        }
    }
}

function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    if (!toastContainer) return;
    
    const toastId = 'toast-' + Date.now();
    
    const bgClass = {
        'success': 'bg-success',
        'error': 'bg-danger',
        'warning': 'bg-warning',
        'info': 'bg-info'
    }[type] || 'bg-info';
    
    const toastHTML = `
        <div id="${toastId}" class="toast align-items-center text-white ${bgClass} border-0" role="alert">
            <div class="d-flex">
                <div class="toast-body">${message}</div>
                <button type="button" class="btn-close btn-close-white me-2 m-auto" data-bs-dismiss="toast"></button>
            </div>
        </div>
    `;
    
    toastContainer.insertAdjacentHTML('beforeend', toastHTML);
    
    const toastElement = document.getElementById(toastId);
    const toast = new bootstrap.Toast(toastElement, {
        autohide: true,
        delay: 5000
    });
    
    toast.show();
    
    toastElement.addEventListener('hidden.bs.toast', function() {
        toastElement.remove();
    });
}