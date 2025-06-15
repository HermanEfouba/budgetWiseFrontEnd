// Transactions functionality for BudgetWise

let allTransactions = [];
let categories = [];

// Initialize transactions page
function initTransactions() {
    if (!requireAuth()) return;
    
    setupDateInputs();
    loadCategories();
    loadTransactions();
    setupEventListeners();
    
    // Check for URL parameters to pre-select form type
    const params = getQueryParams();
    if (params.type === 'revenue') {
        document.getElementById('revenueAmount').focus();
    } else if (params.type === 'expense') {
        document.getElementById('expenseAmount').focus();
    }
}

// Setup date inputs with current date
function setupDateInputs() {
    const today = formatDateForInput(new Date());
    const revenueDate = document.getElementById('revenueDate');
    const expenseDate = document.getElementById('expenseDate');
    
    if (revenueDate) revenueDate.value = today;
    if (expenseDate) expenseDate.value = today;
}

// Setup event listeners
function setupEventListeners() {
    // Form submissions
    const revenueForm = document.getElementById('addRevenueForm');
    const expenseForm = document.getElementById('addExpenseForm');
    
    if (revenueForm) {
        revenueForm.addEventListener('submit', handleAddRevenue);
    }
    
    if (expenseForm) {
        expenseForm.addEventListener('submit', handleAddExpense);
    }
    
    // Filter changes
    const filterInputs = ['filterType', 'filterCategory', 'filterStartDate', 'filterEndDate'];
    filterInputs.forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.addEventListener('change', debounce(applyFilters, 300));
        }
    });
}

// Load categories
async function loadCategories() {
    try {
        categories = await apiRequest('/categories');
        populateCategorySelects();
    } catch (error) {
        console.error('Error loading categories:', error);
        showToast('Erreur lors du chargement des catégories', 'error');
    }
}

// Populate category select elements
function populateCategorySelects() {
    const expenseCategory = document.getElementById('expenseCategory');
    const filterCategory = document.getElementById('filterCategory');
    
    if (expenseCategory) {
        expenseCategory.innerHTML = '<option value="">Sélectionner une catégorie</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            expenseCategory.appendChild(option);
        });
    }
    
    if (filterCategory) {
        filterCategory.innerHTML = '<option value="">Toutes les catégories</option>';
        categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category.id;
            option.textContent = category.name;
            filterCategory.appendChild(option);
        });
    }
}

// Load transactions
async function loadTransactions() {
    const user = getCurrentUser();
    if (!user) return;
    
    showElement('loadingTransactions', true);
    showElement('noTransactionsMessage', false);
    
    try {
        const [expenses, revenues] = await Promise.all([
            apiRequest(`/expenses?user_id=${user.id}`),
            apiRequest(`/revenues?user_id=${user.id}`)
        ]);
        
        allTransactions = [
            ...expenses.map(t => ({ ...t, type: 'expense' })),
            ...revenues.map(t => ({ ...t, type: 'revenue' }))
        ];
        
        displayTransactions(allTransactions);
    } catch (error) {
        console.error('Error loading transactions:', error);
        showToast('Erreur lors du chargement des transactions', 'error');
        showElement('noTransactionsMessage', true);
    } finally {
        showElement('loadingTransactions', false);
    }
}

// Display transactions
function displayTransactions(transactions) {
    const tableBody = document.getElementById('transactionsTable');
    const noDataMessage = document.getElementById('noTransactionsMessage');
    const transactionCount = document.getElementById('transactionCount');
    
    if (!tableBody) return;
    
    if (transactions.length === 0) {
        tableBody.innerHTML = '';
        showElement('noTransactionsMessage', true);
        if (transactionCount) transactionCount.textContent = '0 transactions';
        return;
    }
    
    showElement('noTransactionsMessage', false);
    if (transactionCount) {
        transactionCount.textContent = `${transactions.length} transaction${transactions.length > 1 ? 's' : ''}`;
    }
    
    // Sort by date (most recent first)
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    tableBody.innerHTML = '';
    
    transactions.forEach(transaction => {
        const isExpense = transaction.type === 'expense';
        const row = document.createElement('tr');
        row.className = 'fade-in';
        
        const description = isExpense ? transaction.description : transaction.source;
        const categoryName = isExpense && transaction.category ? transaction.category.name : 'Revenu';
        const transactionType = isExpense ? transaction.type : 'Revenu';
        
        row.innerHTML = `
            <td>${formatDate(transaction.date)}</td>
            <td>${description}</td>
            <td>
                <span class="badge ${isExpense ? 'bg-secondary' : 'bg-primary'} rounded-pill">
                    ${categoryName}
                </span>
            </td>
            <td>
                <span class="badge ${getTypeColor(transactionType)} rounded-pill">
                    ${transactionType}
                </span>
            </td>
            <td class="${isExpense ? 'text-danger' : 'text-success'} fw-bold">
                ${isExpense ? '-' : '+'}${formatCurrency(transaction.amount)}
            </td>
            <td>
                <div class="btn-group btn-group-sm">
                    <button class="btn btn-outline-primary" onclick="editTransaction(${transaction.id}, '${transaction.type}')">
                        Modifier
                    </button>
                    <button class="btn btn-outline-danger" onclick="deleteTransaction(${transaction.id}, '${transaction.type}')">
                        Supprimer
                    </button>
                </div>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Get type color for badge
function getTypeColor(type) {
    const colors = {
        'fixe': 'bg-danger',
        'variable': 'bg-warning',
        'occasionnel': 'bg-info',
        'Revenu': 'bg-success'
    };
    return colors[type] || 'bg-secondary';
}

// Handle add revenue
async function handleAddRevenue(e) {
    e.preventDefault();
    
    const user = getCurrentUser();
    if (!user) return;
    
    const amount = parseFloat(document.getElementById('revenueAmount').value);
    const source = document.getElementById('revenueSource').value.trim();
    const date = document.getElementById('revenueDate').value;
    const spinner = document.getElementById('revenueSpinner');
    
    // Validation
    if (!amount || amount <= 0) {
        showToast('Veuillez entrer un montant valide', 'error');
        return;
    }
    
    if (!source) {
        showToast('Veuillez entrer une source', 'error');
        return;
    }
    
    if (!date) {
        showToast('Veuillez sélectionner une date', 'error');
        return;
    }
    
    // Show loading
    if (spinner) spinner.classList.remove('d-none');
    
    try {
        await apiRequest('/revenues/', {
            method: 'POST',
            body: JSON.stringify({
                amount: amount,
                source: source,
                date: date,
                user_id: user.id
            })
        });
        
        showToast('Revenu ajouté avec succès !', 'success');
        document.getElementById('addRevenueForm').reset();
        setupDateInputs();
        await loadTransactions();
    } catch (error) {
        console.error('Error adding revenue:', error);
        showToast(error.message || 'Erreur lors de l\'ajout du revenu', 'error');
    } finally {
        if (spinner) spinner.classList.add('d-none');
    }
}

// Handle add expense
async function handleAddExpense(e) {
    e.preventDefault();
    
    const user = getCurrentUser();
    if (!user) return;
    
    const amount = parseFloat(document.getElementById('expenseAmount').value);
    const description = document.getElementById('expenseDescription').value.trim();
    const categoryId = parseInt(document.getElementById('expenseCategory').value);
    const type = document.getElementById('expenseType').value;
    const date = document.getElementById('expenseDate').value;
    const spinner = document.getElementById('expenseSpinner');
    
    // Validation
    if (!amount || amount <= 0) {
        showToast('Veuillez entrer un montant valide', 'error');
        return;
    }
    
    if (!description) {
        showToast('Veuillez entrer une description', 'error');
        return;
    }
    
    if (!categoryId) {
        showToast('Veuillez sélectionner une catégorie', 'error');
        return;
    }
    
    if (!type) {
        showToast('Veuillez sélectionner un type', 'error');
        return;
    }
    
    if (!date) {
        showToast('Veuillez sélectionner une date', 'error');
        return;
    }
    
    // Show loading
    if (spinner) spinner.classList.remove('d-none');
    
    try {
        await apiRequest('/expenses/', {
            method: 'POST',
            body: JSON.stringify({
                amount: amount,
                description: description,
                category_id: categoryId,
                type: type,
                date: date,
                user_id: user.id
            })
        });
        
        showToast('Dépense ajoutée avec succès !', 'success');
        document.getElementById('addExpenseForm').reset();
        setupDateInputs();
        await loadTransactions();
    } catch (error) {
        console.error('Error adding expense:', error);
        showToast(error.message || 'Erreur lors de l\'ajout de la dépense', 'error');
    } finally {
        if (spinner) spinner.classList.add('d-none');
    }
}

// Apply filters
function applyFilters() {
    const filterType = document.getElementById('filterType').value;
    const filterCategory = document.getElementById('filterCategory').value;
    const filterStartDate = document.getElementById('filterStartDate').value;
    const filterEndDate = document.getElementById('filterEndDate').value;
    
    let filteredTransactions = [...allTransactions];
    
    // Filter by type
    if (filterType) {
        filteredTransactions = filteredTransactions.filter(t => t.type === filterType);
    }
    
    // Filter by category
    if (filterCategory) {
        filteredTransactions = filteredTransactions.filter(t => 
            t.type === 'expense' && t.category_id === parseInt(filterCategory)
        );
    }
    
    // Filter by date range
    if (filterStartDate) {
        filteredTransactions = filteredTransactions.filter(t => 
            new Date(t.date) >= new Date(filterStartDate)
        );
    }
    
    if (filterEndDate) {
        filteredTransactions = filteredTransactions.filter(t => 
            new Date(t.date) <= new Date(filterEndDate)
        );
    }
    
    displayTransactions(filteredTransactions);
}

// Clear filters
function clearFilters() {
    document.getElementById('filterType').value = '';
    document.getElementById('filterCategory').value = '';
    document.getElementById('filterStartDate').value = '';
    document.getElementById('filterEndDate').value = '';
    
    displayTransactions(allTransactions);
}

// Edit transaction
function editTransaction(id, type) {
    showToast('Fonctionnalité de modification en cours de développement', 'info');
}

// Delete transaction
async function deleteTransaction(id, type) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette transaction ?')) {
        return;
    }
    
    const user = getCurrentUser();
    if (!user) return;
    
    try {
        const endpoint = type === 'expense' ? 'expenses' : 'revenues';
        await apiRequest(`/${endpoint}/${id}?user_id=${user.id}`, {
            method: 'DELETE'
        });
        
        showToast('Transaction supprimée avec succès !', 'success');
        await loadTransactions();
    } catch (error) {
        console.error('Error deleting transaction:', error);
        showToast(error.message || 'Erreur lors de la suppression', 'error');
    }
}

// Initialize transactions page on load
document.addEventListener('DOMContentLoaded', function() {
    initTransactions();
});