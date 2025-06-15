// Budget functionality for BudgetWise

let budgetHistory = [];

// Initialize budget page
function initBudget() {
    if (!requireAuth()) return;
    
    setupCurrentMonth();
    loadCurrentBudget();
    loadBudgetHistory();
    setupEventListeners();
}

// Setup current month display
function setupCurrentMonth() {
    const currentMonth = getCurrentMonth();
    const currentMonthElement = document.getElementById('currentMonth');
    const budgetMonthInput = document.getElementById('budgetMonth');
    
    if (currentMonthElement) {
        currentMonthElement.textContent = getMonthName(currentMonth);
    }
    
    if (budgetMonthInput) {
        budgetMonthInput.value = currentMonth;
    }
}

// Setup event listeners
function setupEventListeners() {
    const setBudgetForm = document.getElementById('setBudgetForm');
    if (setBudgetForm) {
        setBudgetForm.addEventListener('submit', handleSetBudget);
    }
}

// Load current budget
async function loadCurrentBudget() {
    const user = getCurrentUser();
    if (!user) return;
    
    const currentMonth = getCurrentMonth();
    
    try {
        // Get budget for current month
        const budget = await apiRequest(`/budgets/month/${currentMonth}?user_id=${user.id}`);
        
        // Get expenses for current month
        const startDate = `${currentMonth}-01`;
        const endDate = `${currentMonth}-31`;
        const expenses = await apiRequest(`/expenses?user_id=${user.id}&start_date=${startDate}&end_date=${endDate}`);
        
        const totalExpenses = sumByProperty(expenses, 'amount');
        const remaining = budget.amount - totalExpenses;
        const percentageUsed = calculatePercentage(totalExpenses, budget.amount);
        
        updateCurrentBudgetDisplay(budget.amount, totalExpenses, remaining, percentageUsed);
    } catch (error) {
        console.error('Error loading current budget:', error);
        // If no budget found, show default values
        updateCurrentBudgetDisplay(0, 0, 0, 0);
    }
}

// Update current budget display
function updateCurrentBudgetDisplay(budgetAmount, spentAmount, remainingAmount, percentageUsed) {
    const elements = {
        budgetAmount: document.getElementById('budgetAmount'),
        spentAmount: document.getElementById('spentAmount'),
        remainingAmount: document.getElementById('remainingAmount'),
        percentageUsed: document.getElementById('percentageUsed'),
        budgetProgressBar: document.getElementById('budgetProgressBar')
    };
    
    if (elements.budgetAmount) {
        elements.budgetAmount.textContent = formatCurrency(budgetAmount);
    }
    
    if (elements.spentAmount) {
        elements.spentAmount.textContent = formatCurrency(spentAmount);
    }
    
    if (elements.remainingAmount) {
        elements.remainingAmount.textContent = formatCurrency(remainingAmount);
        elements.remainingAmount.className = remainingAmount >= 0 ? 'text-success' : 'text-danger';
    }
    
    if (elements.percentageUsed) {
        elements.percentageUsed.textContent = `${percentageUsed}%`;
        elements.percentageUsed.className = percentageUsed > 100 ? 'text-danger' : percentageUsed > 80 ? 'text-warning' : '';
    }
    
    if (elements.budgetProgressBar) {
        elements.budgetProgressBar.style.width = `${Math.min(percentageUsed, 100)}%`;
        elements.budgetProgressBar.className = `progress-bar ${
            percentageUsed > 100 ? 'bg-danger' : 
            percentageUsed > 80 ? 'bg-warning' : 
            'bg-success'
        }`;
        
        // Add animation
        setTimeout(() => {
            elements.budgetProgressBar.style.transition = 'width 1s ease-in-out';
        }, 100);
    }
}

// Load budget history
async function loadBudgetHistory() {
    const user = getCurrentUser();
    if (!user) return;
    
    try {
        const budgets = await apiRequest(`/budgets?user_id=${user.id}`);
        budgetHistory = budgets;
        
        // Get expenses for each budget month
        const budgetHistoryWithExpenses = await Promise.all(
            budgets.map(async (budget) => {
                try {
                    const startDate = `${budget.month}-01`;
                    const endDate = `${budget.month}-31`;
                    const expenses = await apiRequest(`/expenses?user_id=${user.id}&start_date=${startDate}&end_date=${endDate}`);
                    const totalExpenses = sumByProperty(expenses, 'amount');
                    
                    return {
                        ...budget,
                        spent: totalExpenses,
                        remaining: budget.amount - totalExpenses,
                        percentageUsed: calculatePercentage(totalExpenses, budget.amount)
                    };
                } catch (error) {
                    return {
                        ...budget,
                        spent: 0,
                        remaining: budget.amount,
                        percentageUsed: 0
                    };
                }
            })
        );
        
        displayBudgetHistory(budgetHistoryWithExpenses);
    } catch (error) {
        console.error('Error loading budget history:', error);
        showElement('noBudgetHistory', true);
    }
}

// Display budget history
function displayBudgetHistory(budgets) {
    const tableBody = document.getElementById('budgetHistoryTable');
    const noDataMessage = document.getElementById('noBudgetHistory');
    
    if (!tableBody) return;
    
    if (budgets.length === 0) {
        tableBody.innerHTML = '';
        showElement('noBudgetHistory', true);
        return;
    }
    
    showElement('noBudgetHistory', false);
    
    // Sort by month (most recent first)
    budgets.sort((a, b) => b.month.localeCompare(a.month));
    
    tableBody.innerHTML = '';
    
    budgets.forEach(budget => {
        const row = document.createElement('tr');
        row.className = 'fade-in';
        
        const status = budget.percentageUsed > 100 ? 'Dépassé' : 
                      budget.percentageUsed > 80 ? 'Attention' : 'OK';
        const statusClass = budget.percentageUsed > 100 ? 'bg-danger' : 
                           budget.percentageUsed > 80 ? 'bg-warning' : 'bg-success';
        
        row.innerHTML = `
            <td>${getMonthName(budget.month)}</td>
            <td class="fw-bold">${formatCurrency(budget.amount)}</td>
            <td class="text-danger">${formatCurrency(budget.spent)}</td>
            <td class="${budget.remaining >= 0 ? 'text-success' : 'text-danger'} fw-bold">
                ${formatCurrency(budget.remaining)}
            </td>
            <td>
                <div class="d-flex align-items-center">
                    <span class="me-2">${budget.percentageUsed}%</span>
                    <div class="progress flex-grow-1" style="height: 8px;">
                        <div class="progress-bar ${statusClass.replace('bg-', 'bg-')}" 
                             style="width: ${Math.min(budget.percentageUsed, 100)}%"></div>
                    </div>
                </div>
            </td>
            <td>
                <span class="badge ${statusClass} rounded-pill">${status}</span>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Show set budget form
function showSetBudgetForm() {
    showElement('setBudgetSection', true);
    document.getElementById('budgetAmountInput').focus();
}

// Hide budget form
function hideBudgetForm() {
    showElement('setBudgetSection', false);
    document.getElementById('setBudgetForm').reset();
    setupCurrentMonth();
}

// Handle set budget
async function handleSetBudget(e) {
    e.preventDefault();
    
    const user = getCurrentUser();
    if (!user) return;
    
    const month = document.getElementById('budgetMonth').value;
    const amount = parseFloat(document.getElementById('budgetAmountInput').value);
    const spinner = document.getElementById('budgetSpinner');
    
    // Validation
    if (!month) {
        showToast('Veuillez sélectionner un mois', 'error');
        return;
    }
    
    if (!amount || amount <= 0) {
        showToast('Veuillez entrer un montant valide', 'error');
        return;
    }
    
    // Show loading
    if (spinner) spinner.classList.remove('d-none');
    
    try {
        await apiRequest('/budgets/', {
            method: 'POST',
            body: JSON.stringify({
                month: month,
                amount: amount,
                user_id: user.id
            })
        });
        
        showToast('Budget défini avec succès !', 'success');
        hideBudgetForm();
        await loadCurrentBudget();
        await loadBudgetHistory();
    } catch (error) {
        console.error('Error setting budget:', error);
        showToast(error.message || 'Erreur lors de la définition du budget', 'error');
    } finally {
        if (spinner) spinner.classList.add('d-none');
    }
}

// Initialize budget page on load
document.addEventListener('DOMContentLoaded', function() {
    initBudget();
});