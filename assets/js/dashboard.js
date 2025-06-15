// Dashboard functionality for BudgetWise

let expenseChart = null;

// Initialize dashboard
function initDashboard() {
    if (!requireAuth()) return;
    
    loadDashboardData();
    
    // Set up auto-refresh every 5 minutes
    setInterval(loadDashboardData, 5 * 60 * 1000);
}

// Load dashboard data
async function loadDashboardData() {
    const user = getCurrentUser();
    if (!user) return;
    
    try {
        const response = await apiRequest(`/budgets/dashboard?user_id=${user.id}`);
        updateDashboardStats(response);
        await loadRecentTransactions();
        updateExpenseChart(response.top_categories);
    } catch (error) {
        console.error('Error loading dashboard data:', error);
        showToast('Erreur lors du chargement des données', 'error');
    }
}

// Update dashboard statistics
function updateDashboardStats(data) {
    const elements = {
        currentBalance: document.getElementById('currentBalance'),
        monthlyRevenue: document.getElementById('monthlyRevenue'),
        monthlyExpenses: document.getElementById('monthlyExpenses'),
        budgetRemaining: document.getElementById('budgetRemaining')
    };
    
    if (elements.currentBalance) {
        elements.currentBalance.textContent = formatCurrency(data.current_balance);
        elements.currentBalance.className = data.current_balance >= 0 ? 'mb-0' : 'mb-0 text-warning';
    }
    
    if (elements.monthlyRevenue) {
        elements.monthlyRevenue.textContent = formatCurrency(data.total_revenue_this_month);
    }
    
    if (elements.monthlyExpenses) {
        elements.monthlyExpenses.textContent = formatCurrency(data.total_expenses_this_month);
    }
    
    if (elements.budgetRemaining) {
        elements.budgetRemaining.textContent = formatCurrency(data.budget_remaining);
        elements.budgetRemaining.className = data.budget_remaining >= 0 ? 'mb-0' : 'mb-0 text-warning';
    }
    
    // Add animation to cards
    document.querySelectorAll('.card.bg-primary, .card.bg-success, .card.bg-danger, .card.bg-info').forEach(card => {
        card.classList.add('bounce-in');
    });
}

// Load recent transactions
async function loadRecentTransactions() {
    const user = getCurrentUser();
    if (!user) return;
    
    try {
        const [expensesResponse, revenuesResponse] = await Promise.all([
            apiRequest(`/expenses?user_id=${user.id}&limit=5`),
            apiRequest(`/revenues?user_id=${user.id}&limit=5`)
        ]);
        
        const allTransactions = [
            ...expensesResponse.map(t => ({ ...t, type: 'expense' })),
            ...revenuesResponse.map(t => ({ ...t, type: 'revenue' }))
        ];
        
        displayRecentTransactions(allTransactions);
    } catch (error) {
        console.error('Error loading recent transactions:', error);
        showElement('noTransactionsMessage', true);
    }
}

// Display recent transactions
function displayRecentTransactions(transactions) {
    const container = document.getElementById('recentTransactions');
    const noDataMessage = document.getElementById('noTransactionsMessage');
    
    if (!container) return;
    
    if (transactions.length === 0) {
        container.innerHTML = '';
        showElement('noTransactionsMessage', true);
        return;
    }
    
    showElement('noTransactionsMessage', false);
    
    // Sort by date (most recent first)
    transactions.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    container.innerHTML = '';
    
    transactions.slice(0, 5).forEach(transaction => {
        const isExpense = transaction.type === 'expense';
        const item = document.createElement('div');
        item.className = 'list-group-item d-flex justify-content-between align-items-center fade-in';
        
        const description = isExpense ? transaction.description : transaction.source;
        const categoryName = isExpense && transaction.category ? transaction.category.name : 'Revenu';
        
        item.innerHTML = `
            <div>
                <div class="fw-medium">${description}</div>
                <small class="text-muted">${formatDate(transaction.date)} • ${categoryName}</small>
            </div>
            <span class="badge ${isExpense ? 'bg-danger' : 'bg-success'} rounded-pill">
                ${isExpense ? '-' : '+'}${formatCurrency(transaction.amount)}
            </span>
        `;
        
        container.appendChild(item);
    });
}

// Update expense chart
function updateExpenseChart(categoryData) {
    const ctx = document.getElementById('expenseChart');
    const noDataMessage = document.getElementById('noDataMessage');
    
    if (!ctx) return;
    
    if (!categoryData || categoryData.length === 0) {
        showElement('noDataMessage', true);
        if (expenseChart) {
            expenseChart.destroy();
            expenseChart = null;
        }
        return;
    }
    
    showElement('noDataMessage', false);
    
    if (expenseChart) {
        expenseChart.destroy();
    }
    
    const labels = categoryData.map(item => item.category_name);
    const data = categoryData.map(item => item.total_amount);
    const colors = generateColorPalette(data.length);
    
    expenseChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
                borderWidth: 2,
                borderColor: '#fff',
                hoverBorderWidth: 3,
                hoverBorderColor: '#fff'
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
                        usePointStyle: true,
                        font: {
                            size: 12
                        }
                    }
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const label = context.label || '';
                            const value = formatCurrency(context.parsed);
                            const percentage = Math.round((context.parsed / data.reduce((a, b) => a + b, 0)) * 100);
                            return `${label}: ${value} (${percentage}%)`;
                        }
                    }
                }
            },
            animation: {
                animateRotate: true,
                animateScale: true,
                duration: 1000
            }
        }
    });
}

// Handle quick action clicks
function handleQuickAction(type) {
    const params = getQueryParams();
    
    switch (type) {
        case 'revenue':
            window.location.href = 'transactions.html?type=revenue';
            break;
        case 'expense':
            window.location.href = 'transactions.html?type=expense';
            break;
        case 'budget':
            window.location.href = 'budget.html';
            break;
        case 'statistics':
            window.location.href = 'statistics.html';
            break;
    }
}

// Initialize dashboard on page load
document.addEventListener('DOMContentLoaded', function() {
    initDashboard();
});

// Handle window resize for chart responsiveness
window.addEventListener('resize', debounce(function() {
    if (expenseChart) {
        expenseChart.resize();
    }
}, 250));