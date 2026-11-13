/**
 * dashboard.js
 * Dashboard overview KPIs, monthly spending chart, category breakdown chart, and recent transactions.
 */

import { computeBudgetStatus } from './budget.js';
import {
  computeCategoryBreakdown,
  computeFinancialSummary,
  computeMonthlySeries,
  escapeHtml,
  filterAndSortTransactions,
  formatCurrency,
  formatDate,
  formatMonthLabel,
} from './transactions.js';

let monthlyChartInstance = null;
let categoryChartInstance = null;

function destroyChart(instance) {
  if (instance && typeof instance.destroy === 'function') {
    instance.destroy();
  }
}

/**
 * Renders the Dashboard view from current transactions and active month budget.
 */
export function renderDashboardView(transactions, activeMonth, monthlyBudget, callbacks) {
  const summary = computeFinancialSummary(transactions, activeMonth);
  const monthLabel = formatMonthLabel(activeMonth);
  const budgetInfo = computeBudgetStatus(monthlyBudget, summary.monthlyExpenses);

  // 1. Summary KPI Cards
  const balanceEl = document.getElementById('dash-total-balance');
  const balanceMetaEl = document.getElementById('dash-balance-meta');
  const incomeEl = document.getElementById('dash-total-income');
  const incomeMetaEl = document.getElementById('dash-income-meta');
  const expensesEl = document.getElementById('dash-total-expenses');
  const expensesMetaEl = document.getElementById('dash-expenses-meta');
  const monthlyEl = document.getElementById('dash-monthly-spending');
  const monthlyMetaEl = document.getElementById('dash-monthly-meta');

  if (balanceEl) {
    balanceEl.textContent = formatCurrency(summary.totalBalance);
    balanceEl.className = `kpi-value tabular-nums ${
      summary.totalBalance < 0 ? 'text-expense' : ''
    }`;
  }
  if (balanceMetaEl) {
    balanceMetaEl.textContent = `${transactions.length} total ${
      transactions.length === 1 ? 'entry' : 'entries'
    } recorded`;
  }

  if (incomeEl) incomeEl.textContent = formatCurrency(summary.totalIncome);
  if (incomeMetaEl) {
    incomeMetaEl.textContent = `${summary.incomeCount} income ${
      summary.incomeCount === 1 ? 'entry' : 'entries'
    }`;
  }

  if (expensesEl) expensesEl.textContent = formatCurrency(summary.totalExpenses);
  if (expensesMetaEl) {
    expensesMetaEl.textContent = `${summary.expenseCount} expense ${
      summary.expenseCount === 1 ? 'entry' : 'entries'
    }`;
  }

  if (monthlyEl) monthlyEl.textContent = formatCurrency(summary.monthlyExpenses);
  if (monthlyMetaEl) {
    monthlyMetaEl.textContent = budgetInfo.budget
      ? `${monthLabel} · ${budgetInfo.percentage.toFixed(0)}% of budget`
      : `${monthLabel} · ${summary.monthlyExpenseCount} expenses`;
  }

  // 2. Conditional Budget Alert Strip
  const noticeEl = document.getElementById('dash-budget-notice');
  if (noticeEl) {
    if (budgetInfo.status === 'warning') {
      noticeEl.className = 'notice-banner notice-warning';
      noticeEl.innerHTML = `
        <div class="notice-content">
          <i data-lucide="alert-triangle"></i>
          <span><strong>Budget Warning (${escapeHtml(monthLabel)}):</strong> ${budgetInfo.percentage.toFixed(
        1
      )}% of your ${formatCurrency(budgetInfo.budget)} monthly budget is used.</span>
        </div>
        <button type="button" class="btn btn-ghost" id="dash-goto-budget-btn">Manage Budget</button>
      `;
    } else if (budgetInfo.status === 'exceeded') {
      noticeEl.className = 'notice-banner notice-exceeded';
      noticeEl.innerHTML = `
        <div class="notice-content">
          <i data-lucide="alert-octagon"></i>
          <span><strong>Budget Exceeded (${escapeHtml(monthLabel)}):</strong> Monthly expenses exceed your limit by ${formatCurrency(
        Math.abs(budgetInfo.remaining)
      )}.</span>
        </div>
        <button type="button" class="btn btn-ghost" id="dash-goto-budget-btn">Review Budget</button>
      `;
    } else {
      noticeEl.className = 'notice-banner hidden';
      noticeEl.innerHTML = '';
    }

    const gotoBudgetBtn = document.getElementById('dash-goto-budget-btn');
    if (gotoBudgetBtn) {
      gotoBudgetBtn.addEventListener('click', () => callbacks.onNavigate('budget'));
    }
  }

  // 3. Monthly Spending Overview Chart
  renderMonthlyOverviewChart(transactions, activeMonth);

  // 4. Expense Category Breakdown Chart
  renderCategoryBreakdownChart(transactions, activeMonth);

  // 5. Recent Transactions Table
  renderRecentTransactions(transactions, callbacks);
}

function renderMonthlyOverviewChart(transactions, activeMonth) {
  const canvas = document.getElementById('dash-monthly-chart');
  const emptyEl = document.getElementById('dash-monthly-empty');
  const subtitleEl = document.getElementById('dash-overview-subtitle');
  if (!canvas) return;

  const series = computeMonthlySeries(transactions, activeMonth, 6);
  const hasAnyData = series.some((s) => s.income > 0 || s.expense > 0);

  if (subtitleEl) {
    subtitleEl.textContent = `6-month cash flow ending ${formatMonthLabel(activeMonth)}`;
  }

  destroyChart(monthlyChartInstance);
  monthlyChartInstance = null;

  if (!hasAnyData || typeof window.Chart === 'undefined') {
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }
  if (emptyEl) emptyEl.classList.add('hidden');

  const ctx = canvas.getContext('2d');
  monthlyChartInstance = new window.Chart(ctx, {
    type: 'bar',
    data: {
      labels: series.map((s) => s.label),
      datasets: [
        {
          label: 'Income',
          data: series.map((s) => s.income),
          backgroundColor: '#15803d',
          borderRadius: 4,
          barPercentage: 0.7,
          categoryPercentage: 0.68,
        },
        {
          label: 'Expenses',
          data: series.map((s) => s.expense),
          backgroundColor: '#0f172a',
          borderRadius: 4,
          barPercentage: 0.7,
          categoryPercentage: 0.68,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'top',
          align: 'end',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            usePointStyle: true,
            pointStyle: 'rectRounded',
            color: '#475569',
            font: { family: 'Plus Jakarta Sans', size: 12 },
          },
        },
        tooltip: {
          callbacks: {
            label: (context) => `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`,
          },
        },
      },
      scales: {
        x: {
          grid: { display: false },
          ticks: { color: '#64748b', font: { family: 'Plus Jakarta Sans', size: 11 } },
        },
        y: {
          beginAtZero: true,
          grid: { color: '#f1f5f9' },
          border: { display: false },
          ticks: {
            color: '#64748b',
            font: { family: 'JetBrains Mono', size: 11 },
            callback: (val) => `$${Number(val).toLocaleString()}`,
          },
        },
      },
    },
  });
}

function renderCategoryBreakdownChart(transactions, activeMonth) {
  const canvas = document.getElementById('dash-category-chart');
  const emptyEl = document.getElementById('dash-category-empty');
  const subtitleEl = document.getElementById('dash-category-subtitle');
  if (!canvas) return;

  // Prefer active month expenses; fallback message if none
  const breakdown = computeCategoryBreakdown(transactions, 'expense', activeMonth);
  if (subtitleEl) {
    subtitleEl.textContent = `Expenses in ${formatMonthLabel(activeMonth)}`;
  }

  destroyChart(categoryChartInstance);
  categoryChartInstance = null;

  if (breakdown.length === 0 || typeof window.Chart === 'undefined') {
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }
  if (emptyEl) emptyEl.classList.add('hidden');

  const ctx = canvas.getContext('2d');
  categoryChartInstance = new window.Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: breakdown.map((b) => b.category),
      datasets: [
        {
          data: breakdown.map((b) => b.amount),
          backgroundColor: breakdown.map((b) => b.color),
          borderColor: '#ffffff',
          borderWidth: 2,
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '64%',
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 10,
            boxHeight: 10,
            padding: 12,
            color: '#334155',
            font: { family: 'Plus Jakarta Sans', size: 12 },
          },
        },
        tooltip: {
          callbacks: {
            label: (context) => {
              const item = breakdown[context.dataIndex];
              return `${item.category}: ${formatCurrency(item.amount)} (${item.share.toFixed(1)}%)`;
            },
          },
        },
      },
    },
  });
}

function renderRecentTransactions(transactions, callbacks) {
  const wrap = document.getElementById('dash-recent-table-wrap');
  if (!wrap) return;

  const recent = filterAndSortTransactions(transactions, {
    search: '',
    type: 'all',
    category: 'all',
    sort: 'date-desc',
  }).slice(0, 6);

  if (recent.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="wallet"></i></div>
        <h3 class="empty-state-title">No recent transactions</h3>
        <p class="empty-state-desc">Add your first income or expense entry to populate your dashboard summary and charts.</p>
        <button type="button" class="btn btn-primary" id="dash-empty-add-btn">Add Transaction</button>
      </div>
    `;
    const btn = document.getElementById('dash-empty-add-btn');
    if (btn) btn.addEventListener('click', callbacks.onOpenAddModal);
    return;
  }

  const rowsHtml = recent
    .map((tx) => {
      const isIncome = tx.type === 'income';
      const sign = isIncome ? '+' : '-';
      const amountClass = isIncome ? 'text-income' : 'text-expense';
      return `
        <tr>
          <td>
            <div class="tx-title-cell">
              <span class="tx-title-text">${escapeHtml(tx.title)}</span>
              ${tx.description ? `<span class="tx-desc-text">${escapeHtml(tx.description)}</span>` : ''}
            </div>
          </td>
          <td><span class="tx-category-text">${escapeHtml(tx.category)}</span></td>
          <td><span class="tx-date-text">${formatDate(tx.date)}</span></td>
          <td class="col-right">
            <span class="tx-amount-text ${amountClass}">${sign}${formatCurrency(tx.amount)}</span>
          </td>
        </tr>
      `;
    })
    .join('');

  wrap.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Transaction</th>
          <th>Category</th>
          <th>Date</th>
          <th class="col-right">Amount</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}
