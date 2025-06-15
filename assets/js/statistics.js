// Statistics functionality for BudgetWise

let charts = {};
let statisticsData = {};

// Initialize statistics page
function initStatistics() {
    if (!requireAuth()) return;
    
    setupPeriodInputs();
    setupEventListeners();
    loadStatistics();
}

// Setup period inputs
function setupPeriodInputs() {
    const today = new Date();
    const startDate = document.getElementById('startDate');
    const endDate = document.getElementById('endDate');
    
    if (startDate) {
        startDate.value = formatDateForInput(new Date(today.getFullYear(), today.getMonth(), 1));
    }
    
    if (endDate) {
        endDate.value = formatDateForInput(today);
    }
}

// Setup event listeners
function setupEventListeners() {
    const periodType = document.getElementById('periodType');
    if (periodType) {
        periodType.addEventListener('change', updatePeriodInputs);
    }
}

// Update period inputs based on selection
function updatePeriodInputs() {
    const periodType = document.getElementById('periodType').value;
    const startDateGroup = document.getElementById('startDateGroup');
    const endDateGroup = document.getElementById('endDateGroup');
    
    if (periodType === 'custom') {
        showElement('startDateGroup', true);
        showElement('endDateGroup', true);
    } else {
        showElement('startDateGroup', false);
        showElement('endDateGroup', false);
    }
}

// Load statistics
async function loadStatistics() {
    const user = getCurrentUser();
    if (!user) return;
    
    const { startDate, endDate } = getSelectedPeriod();
    
    try {
        // Load transactions for the selected period
        const [expenses, revenues] = await Promise.all([
            apiRequest(`/expenses?user_id=${user.id}&start_date=${startDate}&end_date=${endDate}`),
            apiRequest(`/revenues?user_id=${user.id}&start_date=${startDate}&end_date=${endDate}`)
        ]);
        
        statisticsData = {
            expenses,
            revenues,
            startDate,
            endDate
        };
        
        updateSummaryCards();
        updateCategoryChart();
        updateMonthlyChart();
        updateTypeChart();
        updateComparisonChart();
        updateTopCategoriesTable();
    } catch (error) {
        console.error('Error loading statistics:', error);
        showToast('Erreur lors du chargement des statistiques', 'error');
    }
}

// Get selected period
function getSelectedPeriod() {
    const periodType = document.getElementById('periodType').value;
    const today = new Date();
    
    switch (periodType) {
        case 'month':
            return {
                startDate: formatDateForInput(new Date(today.getFullYear(), today.getMonth(), 1)),
                endDate: formatDateForInput(today)
            };
        case 'year':
            return {
                startDate: formatDateForInput(new Date(today.getFullYear(), 0, 1)),
                endDate: formatDateForInput(today)
            };
        case 'custom':
            return {
                startDate: document.getElementById('startDate').value,
                endDate: document.getElementById('endDate').value
            };
        default:
            return {
                startDate: formatDateForInput(new Date(today.getFullYear(), today.getMonth(), 1)),
                endDate: formatDateForInput(today)
            };
    }
}

// Update summary cards
function updateSummaryCards() {
    const { expenses, revenues, startDate, endDate } = statisticsData;
    
    const totalRevenue = sumByProperty(revenues, 'amount');
    const totalExpenses = sumByProperty(expenses, 'amount');
    const netBalance = totalRevenue - totalExpenses;
    
    // Calculate average daily spending
    const daysDiff = Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24));
    const avgDaily = daysDiff > 0 ? totalExpenses / daysDiff : 0;
    
    const elements = {
        totalRevenue: document.getElementById('totalRevenue'),
        totalExpenses: document.getElementById('totalExpenses'),
        netBalance: document.getElementById('netBalance'),
        avgDaily: document.getElementById('avgDaily')
    };
    
    if (elements.totalRevenue) {
        elements.totalRevenue.textContent = formatCurrency(totalRevenue);
    }
    
    if (elements.totalExpenses) {
        elements.totalExpenses.textContent = formatCurrency(totalExpenses);
    }
    
    if (elements.netBalance) {
        elements.netBalance.textContent = formatCurrency(netBalance);
        elements.netBalance.parentElement.className = `card ${netBalance >= 0 ? 'bg-success' : 'bg-danger'} text-white`;
    }
    
    if (elements.avgDaily) {
        elements.avgDaily.textContent = formatCurrency(avgDaily);
    }
}

// Update category chart
function updateCategoryChart() {
    const ctx = document.getElementById('categoryChart');
    const noDataMessage = document.getElementById('noCategoryData');
    
    if (!ctx) return;
    
    const { expenses } = statisticsData;
    const categoryData = groupByProperty(expenses, 'category_id');
    
    if (Object.keys(categoryData).length === 0) {
        showElement('noCategoryData', true);
        if (charts.category) {
            charts.category.destroy();
            delete charts.category;
        }
        return;
    }
    
    showElement('noCategoryData', false);
    
    if (charts.category) {
        charts.category.destroy();
    }
    
    const labels = [];
    const data = [];
    
    Object.entries(categoryData).forEach(([categoryId, categoryExpenses]) => {
        const categoryName = categoryExpenses[0]?.category?.name || 'Sans catégorie';
        const total = sumByProperty(categoryExpenses, 'amount');
        labels.push(categoryName);
        data.push(total);
    });
    
    const colors = generateColorPalette(data.length);
    
    charts.category = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: data,
                backgroundColor: colors,
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
                        padding: 15,
                        usePointStyle: true
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
            }
        }
    });
}

// Update monthly chart
function updateMonthlyChart() {
    const ctx = document.getElementById('monthlyChart');
    const noDataMessage = document.getElementById('noMonthlyData');
    
    if (!ctx) return;
    
    const { expenses, revenues } = statisticsData;
    
    if (expenses.length === 0 && revenues.length === 0) {
        showElement('noMonthlyData', true);
        if (charts.monthly) {
            charts.monthly.destroy();
            delete charts.monthly;
        }
        return;
    }
    
    showElement('noMonthlyData', false);
    
    if (charts.monthly) {
        charts.monthly.destroy();
    }
    
    // Group by month
    const monthlyData = {};
    
    [...expenses, ...revenues].forEach(transaction => {
        const month = transaction.date.substring(0, 7); // YYYY-MM
        if (!monthlyData[month]) {
            monthlyData[month] = { expenses: 0, revenues: 0 };
        }
        
        if (transaction.hasOwnProperty('description')) {
            monthlyData[month].expenses += transaction.amount;
        } else {
            monthlyData[month].revenues += transaction.amount;
        }
    });
    
    const sortedMonths = Object.keys(monthlyData).sort();
    const labels = sortedMonths.map(month => getMonthName(month));
    const expenseData = sortedMonths.map(month => monthlyData[month].expenses);
    const revenueData = sortedMonths.map(month => monthlyData[month].revenues);
    
    charts.monthly = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Revenus',
                    data: revenueData,
                    borderColor: '#198754',
                    backgroundColor: 'rgba(25, 135, 84, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'Dépenses',
                    data: expenseData,
                    borderColor: '#dc3545',
                    backgroundColor: 'rgba(220, 53, 69, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top'
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

// Update type chart
function updateTypeChart() {
    const ctx = document.getElementById('typeChart');
    const noDataMessage = document.getElementById('noTypeData');
    
    if (!ctx) return;
    
    const { expenses } = statisticsData;
    
    if (expenses.length === 0) {
        showElement('noTypeData', true);
        if (charts.type) {
            charts.type.destroy();
            delete charts.type;
        }
        return;
    }
    
    showElement('noTypeData', false);
    
    if (charts.type) {
        charts.type.destroy();
    }
    
    const typeData = groupByProperty(expenses, 'type');
    const labels = Object.keys(typeData);
    const data = labels.map(type => sumByProperty(typeData[type], 'amount'));
    const colors = generateColorPalette(data.length);
    
    charts.type = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Montant',
                data: data,
                backgroundColor: colors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${formatCurrency(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

// Update comparison chart
function updateComparisonChart() {
    const ctx = document.getElementById('comparisonChart');
    const noDataMessage = document.getElementById('noComparisonData');
    
    if (!ctx) return;
    
    const { expenses, revenues } = statisticsData;
    
    if (expenses.length === 0 && revenues.length === 0) {
        showElement('noComparisonData', true);
        if (charts.comparison) {
            charts.comparison.destroy();
            delete charts.comparison;
        }
        return;
    }
    
    showElement('noComparisonData', false);
    
    if (charts.comparison) {
        charts.comparison.destroy();
    }
    
    const totalRevenue = sumByProperty(revenues, 'amount');
    const totalExpenses = sumByProperty(expenses, 'amount');
    
    charts.comparison = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: ['Revenus', 'Dépenses'],
            datasets: [{
                label: 'Montant',
                data: [totalRevenue, totalExpenses],
                backgroundColor: ['#198754', '#dc3545'],
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.label}: ${formatCurrency(context.parsed.y)}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

// Update top categories table
function updateTopCategoriesTable() {
    const tableBody = document.getElementById('topCategoriesTable');
    const noDataMessage = document.getElementById('noTopCategories');
    
    if (!tableBody) return;
    
    const { expenses } = statisticsData;
    
    if (expenses.length === 0) {
        tableBody.innerHTML = '';
        showElement('noTopCategories', true);
        return;
    }
    
    showElement('noTopCategories', false);
    
    const categoryData = groupByProperty(expenses, 'category_id');
    const categoryStats = Object.entries(categoryData).map(([categoryId, categoryExpenses]) => {
        const categoryName = categoryExpenses[0]?.category?.name || 'Sans catégorie';
        const total = sumByProperty(categoryExpenses, 'amount');
        const count = categoryExpenses.length;
        
        return {
            name: categoryName,
            total: total,
            count: count
        };
    });
    
    // Sort by total amount (descending)
    categoryStats.sort((a, b) => b.total - a.total);
    
    const totalExpenses = sumByProperty(expenses, 'amount');
    
    tableBody.innerHTML = '';
    
    categoryStats.forEach((category, index) => {
        const row = document.createElement('tr');
        row.className = 'fade-in';
        
        const percentage = calculatePercentage(category.total, totalExpenses);
        
        row.innerHTML = `
            <td class="fw-bold">${index + 1}</td>
            <td>${category.name}</td>
            <td class="fw-bold">${formatCurrency(category.total)}</td>
            <td>
                <div class="d-flex align-items-center">
                    <span class="me-2">${percentage}%</span>
                    <div class="progress flex-grow-1" style="height: 8px;">
                        <div class="progress-bar bg-primary" style="width: ${percentage}%"></div>
                    </div>
                </div>
            </td>
            <td>
                <span class="badge bg-secondary rounded-pill">${category.count}</span>
            </td>
        `;
        
        tableBody.appendChild(row);
    });
}

// Export to PDF
function exportToPDF() {
    showToast('Fonctionnalité d\'export PDF en cours de développement', 'info');
}

// Export to CSV
function exportToCSV() {
    const { expenses, revenues } = statisticsData;
    
    if (expenses.length === 0 && revenues.length === 0) {
        showToast('Aucune donnée à exporter', 'warning');
        return;
    }
    
    const allTransactions = [
        ...expenses.map(t => ({
            Date: formatDate(t.date),
            Type: 'Dépense',
            Description: t.description,
            Catégorie: t.category?.name || 'Sans catégorie',
            'Type de dépense': t.type,
            Montant: t.amount
        })),
        ...revenues.map(t => ({
            Date: formatDate(t.date),
            Type: 'Revenu',
            Description: t.source,
            Catégorie: 'Revenu',
            'Type de dépense': '',
            Montant: t.amount
        }))
    ];
    
    const filename = `statistiques_${formatDateForInput(new Date())}.csv`;
    exportToCSV(allTransactions, filename);
    showToast('Export CSV téléchargé avec succès !', 'success');
}

// Initialize statistics page on load
document.addEventListener('DOMContentLoaded', function() {
    initStatistics();
});

// Handle window resize for chart responsiveness
window.addEventListener('resize', debounce(function() {
    Object.values(charts).forEach(chart => {
        if (chart) {
            chart.resize();
        }
    });
}, 250));