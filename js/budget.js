/**
 * budget.js
 * Monthly budget calculations and Budget Management view controller.
 */

import {
  computeCategoryBreakdown,
  escapeHtml,
  formatCurrency,
  formatMonthLabel,
} from './transactions.js';

/**
 * Computes budget utilization and threshold status purely from numeric inputs.
 * Warning threshold: >= 80% and <= 100%.
 * Exceeded threshold: > 100%.
 * @param {number|null} budgetAmount
 * @param {number} monthlyExpenses
 */
export function computeBudgetStatus(budgetAmount, monthlyExpenses) {
  const spent = Number(monthlyExpenses) || 0;
  if (!budgetAmount || budgetAmount <= 0) {
    return {
      budget: null,
      spent,
      remaining: null,
      percentage: 0,
      clampedPercentage: 0,
      status: 'unset',
      label: 'Not Set',
    };
  }

  const remaining = budgetAmount - spent;
  const percentage = (spent / budgetAmount) * 100;
  const clampedPercentage = Math.min(Math.max(percentage, 0), 100);

  let status = 'ok';
  let label = 'On Track';

  if (percentage > 100) {
    status = 'exceeded';
    label = 'Budget Exceeded';
  } else if (percentage >= 80) {
    status = 'warning';
    label = 'Approaching Limit';
  }

  return {
    budget: budgetAmount,
    spent,
    remaining,
    percentage,
    clampedPercentage,
    status,
    label,
  };
}

/**
 * Renders the Budget Management view for the active month.
 * @param {Array<object>} transactions
 * @param {string} activeMonth YYYY-MM
 * @param {number|null} budgetAmount
 */
export function renderBudgetView(transactions, activeMonth, budgetAmount) {
  const monthLabel = formatMonthLabel(activeMonth);
  const monthlyExpenses = transactions
    .filter((tx) => tx.type === 'expense' && tx.date && tx.date.startsWith(activeMonth))
    .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);

  const info = computeBudgetStatus(budgetAmount, monthlyExpenses);

  const monthSubtitleEl = document.getElementById('budget-month-label');
  const amountInput = document.getElementById('budget-amount-input');
  const errorEl = document.getElementById('budget-form-error');
  const bannerEl = document.getElementById('budget-alert-banner');
  const indicatorEl = document.getElementById('budget-status-indicator');
  const targetEl = document.getElementById('budget-target-val');
  const spentEl = document.getElementById('budget-spent-val');
  const remainingLabelEl = document.getElementById('budget-remaining-label');
  const remainingEl = document.getElementById('budget-remaining-val');
  const percentEl = document.getElementById('budget-percent-val');
  const progressBar = document.getElementById('budget-progressbar');
  const progressFill = document.getElementById('budget-progress-fill');
  const catListEl = document.getElementById('budget-expenses-list');

  if (monthSubtitleEl) {
    monthSubtitleEl.textContent = `Spending cap for ${monthLabel}`;
  }
  if (amountInput && document.activeElement !== amountInput) {
    amountInput.value = info.budget ? String(info.budget) : '';
  }
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }

  if (targetEl) targetEl.textContent = info.budget ? formatCurrency(info.budget) : '—';
  if (spentEl) spentEl.textContent = formatCurrency(info.spent);

  if (remainingLabelEl && remainingEl) {
    if (info.budget === null) {
      remainingLabelEl.textContent = 'Remaining';
      remainingEl.textContent = '—';
      remainingEl.className = 'budget-metric-val tabular-nums';
    } else if (info.remaining < 0) {
      remainingLabelEl.textContent = 'Over Budget';
      remainingEl.textContent = formatCurrency(Math.abs(info.remaining));
      remainingEl.className = 'budget-metric-val tabular-nums text-expense';
    } else {
      remainingLabelEl.textContent = 'Remaining';
      remainingEl.textContent = formatCurrency(info.remaining);
      remainingEl.className = 'budget-metric-val tabular-nums text-income';
    }
  }

  if (percentEl) {
    percentEl.textContent = info.budget ? `${info.percentage.toFixed(1)}%` : '0%';
  }

  if (progressBar && progressFill) {
    progressBar.setAttribute('aria-valuenow', String(Math.round(info.percentage)));
    progressFill.style.width = `${info.clampedPercentage}%`;
    progressFill.className = 'progress-fill';
    if (info.status === 'warning') progressFill.classList.add('is-warning');
    if (info.status === 'exceeded') progressFill.classList.add('is-exceeded');
  }

  if (indicatorEl) {
    const iconMap = {
      unset: 'minus-circle',
      ok: 'check-circle-2',
      warning: 'alert-triangle',
      exceeded: 'alert-octagon',
    };
    const classMap = {
      unset: 'status-neutral',
      ok: 'status-ok',
      warning: 'status-warning',
      exceeded: 'status-exceeded',
    };
    indicatorEl.className = `status-label ${classMap[info.status]}`;
    indicatorEl.innerHTML = `<i data-lucide="${iconMap[info.status]}"></i><span>${escapeHtml(info.label)}</span>`;
  }

  if (bannerEl) {
    if (info.status === 'warning') {
      bannerEl.className = 'notice-banner notice-warning';
      bannerEl.innerHTML = `
        <div class="notice-content">
          <i data-lucide="alert-triangle"></i>
          <span><strong>Warning:</strong> You have used ${info.percentage.toFixed(1)}% of your ${escapeHtml(
        monthLabel
      )} budget (${formatCurrency(info.remaining)} remaining).</span>
        </div>
      `;
    } else if (info.status === 'exceeded') {
      bannerEl.className = 'notice-banner notice-exceeded';
      bannerEl.innerHTML = `
        <div class="notice-content">
          <i data-lucide="alert-octagon"></i>
          <span><strong>Budget Exceeded:</strong> Monthly spending in ${escapeHtml(
            monthLabel
          )} has exceeded your limit by ${formatCurrency(Math.abs(info.remaining))} (${info.percentage.toFixed(
        1
      )}% utilized).</span>
        </div>
      `;
    } else {
      bannerEl.className = 'notice-banner hidden';
      bannerEl.innerHTML = '';
    }
  }

  if (catListEl) {
    const breakdown = computeCategoryBreakdown(transactions, 'expense', activeMonth);
    if (breakdown.length === 0) {
      catListEl.innerHTML = `<p class="card-subtitle">No expenses recorded in ${escapeHtml(monthLabel)} yet.</p>`;
    } else {
      catListEl.innerHTML = breakdown
        .map(
          (item) => `
          <div class="budget-cat-row">
            <span>${escapeHtml(item.category)} <span class="card-subtitle">(${item.count})</span></span>
            <span class="tx-amount-text tabular-nums">${formatCurrency(item.amount)}</span>
          </div>
        `
        )
        .join('');
    }
  }
}

/**
 * Wires up the monthly budget form and clear button handlers.
 */
export function initBudgetControls(callbacks) {
  const form = document.getElementById('budget-form');
  const amountInput = document.getElementById('budget-amount-input');
  const errorEl = document.getElementById('budget-form-error');
  const clearBtn = document.getElementById('budget-clear-btn');

  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
      }
      if (amountInput) amountInput.classList.remove('invalid');

      const val = Number(amountInput ? amountInput.value : 0);
      if (!Number.isFinite(val) || val <= 0) {
        if (errorEl) {
          errorEl.textContent = 'Enter a valid monthly budget greater than 0.';
          errorEl.classList.remove('hidden');
        }
        if (amountInput) amountInput.classList.add('invalid');
        return;
      }

      callbacks.onSaveBudget(val);
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (amountInput) amountInput.value = '';
      if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
      }
      callbacks.onClearBudget();
    });
  }
}
