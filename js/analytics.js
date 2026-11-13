/**
 * analytics.js
 * Expense Analytics KPIs, comparative Income vs Expense chart,
 * Spending Distribution chart, and Category-Wise Breakdown table.
 */

import {
  computeCategoryBreakdown,
  computeFinancialSummary,
  computeMonthlySeries,
  escapeHtml,
  formatCurrency,
  formatMonthLabel,
} from './transactions.js';

let incomeExpenseChart = null;
let distributionChart = null;

function destroyChart(instance) {
  if (instance && typeof instance.destroy === 'function') {
    instance.destroy();
  }
}

/**
 * Renders the Analytics view.
 * @param {Array<object>} transactions
 * @param {string} activeMonth YYYY-MM
 * @param {'month'|'all'} scope
 */
export function renderAnalyticsView(transactions, activeMonth, scope = 'month') {
  const summary = computeFinancialSummary(transactions, activeMonth);
  const scopeMonth = scope === 'month' ? activeMonth : null;
  const categoryBreakdown = computeCategoryBreakdown(transactions, 'expense', scopeMonth);
  const overallBreakdown = computeCategoryBreakdown(transactions, 'expense', null);
  const topCategorySource = categoryBreakdown.length > 0 ? categoryBreakdown[0] : overallBreakdown[0] || null;
  const monthLabel = formatMonthLabel(activeMonth);

  // 1. KPI Cards
  const totalSavingsEl = document.getElementById('ana-total-savings');
  const savingsRateEl = document.getElementById('ana-savings-rate');
  const topCatEl = document.getElementById('ana-top-category');
  const topCatMetaEl = document.getElementById('ana-top-category-meta');
  const monthlySavingsEl = document.getElementById('ana-monthly-savings');
  const monthlySavingsMetaEl = document.getElementById('ana-monthly-savings-meta');
  const avgExpenseEl = document.getElementById('ana-avg-expense');
  const avgExpenseMetaEl = document.getElementById('ana-avg-expense-meta');

  if (totalSavingsEl) {
    totalSavingsEl.textContent = formatCurrency(summary.totalBalance);
    totalSavingsEl.className = `kpi-value tabular-nums ${
      summary.totalBalance < 0 ? 'text-expense' : 'text-income'
    }`;
  }
  if (savingsRateEl) {
    savingsRateEl.textContent = `${summary.savingsRate.toFixed(1)}% overall savings rate`;
  }

  if (topCatEl && topCatMetaEl) {
    if (topCategorySource) {
      topCatEl.textContent = topCategorySource.category;
      topCatMetaEl.textContent = `${formatCurrency(
        topCategorySource.amount
      )} (${topCategorySource.share.toFixed(1)}% of expenses)`;
    } else {
      topCatEl.textContent = '—';
      topCatMetaEl.textContent = 'No expenses recorded yet';
    }
  }

  if (monthlySavingsEl && monthlySavingsMetaEl) {
    monthlySavingsEl.textContent = formatCurrency(summary.monthlySavings);
    monthlySavingsEl.className = `kpi-value tabular-nums ${
      summary.monthlySavings < 0 ? 'text-expense' : ''
    }`;
    monthlySavingsMetaEl.textContent = `${monthLabel} net savings`;
  }

  if (avgExpenseEl && avgExpenseMetaEl) {
    avgExpenseEl.textContent = formatCurrency(summary.avgExpense);
    avgExpenseMetaEl.textContent = `Across ${summary.expenseCount} expense ${
      summary.expenseCount === 1 ? 'entry' : 'entries'
    }`;
  }

  // 2. Charts & Breakdown Table
  renderIncomeVsExpenseChart(transactions, activeMonth);
  renderDistributionChart(categoryBreakdown, scope, monthLabel);
  renderBreakdownTable(categoryBreakdown, scope, monthLabel);
}

function renderIncomeVsExpenseChart(transactions, activeMonth) {
  const canvas = document.getElementById('ana-income-expense-chart');
  const emptyEl = document.getElementById('ana-income-expense-empty');
  if (!canvas) return;

  const series = computeMonthlySeries(transactions, activeMonth, 6);
  const hasData = series.some((s) => s.income > 0 || s.expense > 0);

  destroyChart(incomeExpenseChart);
  incomeExpenseChart = null;

  if (!hasData || typeof window.Chart === 'undefined') {
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }
  if (emptyEl) emptyEl.classList.add('hidden');

  const ctx = canvas.getContext('2d');
  incomeExpenseChart = new window.Chart(ctx, {
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
          categoryPercentage: 0.65,
        },
        {
          label: 'Expenses',
          data: series.map((s) => s.expense),
          backgroundColor: '#dc2626',
          borderRadius: 4,
          barPercentage: 0.7,
          categoryPercentage: 0.65,
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
            label: (ctxItem) => `${ctxItem.dataset.label}: ${formatCurrency(ctxItem.parsed.y)}`,
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

function renderDistributionChart(breakdown, scope, monthLabel) {
  const canvas = document.getElementById('ana-distribution-chart');
  const emptyEl = document.getElementById('ana-distribution-empty');
  const subtitleEl = document.getElementById('ana-distribution-subtitle');
  if (!canvas) return;

  if (subtitleEl) {
    subtitleEl.textContent =
      scope === 'month' ? `Category share for ${monthLabel}` : 'All-time expense share';
  }

  destroyChart(distributionChart);
  distributionChart = null;

  if (breakdown.length === 0 || typeof window.Chart === 'undefined') {
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }
  if (emptyEl) emptyEl.classList.add('hidden');

  const ctx = canvas.getContext('2d');
  distributionChart = new window.Chart(ctx, {
    type: 'pie',
    data: {
      labels: breakdown.map((b) => b.category),
      datasets: [
        {
          data: breakdown.map((b) => b.amount),
          backgroundColor: breakdown.map((b) => b.color),
          borderColor: '#ffffff',
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
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
            label: (ctxItem) => {
              const item = breakdown[ctxItem.dataIndex];
              return `${item.category}: ${formatCurrency(item.amount)} (${item.share.toFixed(1)}%)`;
            },
          },
        },
      },
    },
  });
}

function renderBreakdownTable(breakdown, scope, monthLabel) {
  const wrap = document.getElementById('ana-category-breakdown-wrap');
  const subtitleEl = document.getElementById('ana-breakdown-subtitle');
  if (!wrap) return;

  if (subtitleEl) {
    subtitleEl.textContent =
      scope === 'month'
        ? `Detailed spend share for ${monthLabel}`
        : 'Detailed spend share across all recorded history';
  }

  if (breakdown.length === 0) {
    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="bar-chart-3"></i></div>
        <h3 class="empty-state-title">No expense data for this period</h3>
        <p class="empty-state-desc">Add expense entries or switch to All Time to inspect your category breakdown.</p>
      </div>
    `;
    return;
  }

  const rowsHtml = breakdown
    .map(
      (item) => `
      <tr>
        <td><strong>${escapeHtml(item.category)}</strong></td>
        <td class="tabular-nums">${item.count} ${item.count === 1 ? 'entry' : 'entries'}</td>
        <td>
          <div class="share-bar-wrap">
            <div class="share-bar-track">
              <div class="share-bar-fill" style="width: ${item.share.toFixed(1)}%; background-color: ${escapeHtml(
        item.color
      )}"></div>
            </div>
            <span class="share-percent tabular-nums">${item.share.toFixed(1)}%</span>
          </div>
        </td>
        <td class="col-right">
          <span class="tx-amount-text tabular-nums">${formatCurrency(item.amount)}</span>
        </td>
      </tr>
    `
    )
    .join('');

  wrap.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Category</th>
          <th>Transactions</th>
          <th>Share of Expenses</th>
          <th class="col-right">Total Spent</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;
}
