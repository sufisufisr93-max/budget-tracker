/**
 * transactions.js
 * Pure financial calculations, validation, and Transaction History UI controller.
 * Independent of storage internals: receives data from app/storage and emits actions.
 */

export const EXPENSE_CATEGORIES = [
  'Food',
  'Housing',
  'Transport',
  'Utilities',
  'Healthcare',
  'Entertainment',
  'Shopping',
  'Education',
  'Other',
];

export const INCOME_CATEGORIES = [
  'Salary',
  'Freelance',
  'Investments',
  'Rental',
  'Gift',
  'Refund',
  'Other',
];

export const CATEGORY_COLORS = {
  Food: '#0f172a',
  Housing: '#2563eb',
  Transport: '#0284c7',
  Utilities: '#0d9488',
  Healthcare: '#dc2626',
  Entertainment: '#d97706',
  Shopping: '#4f46e5',
  Education: '#16a34a',
  Salary: '#15803d',
  Freelance: '#059669',
  Investments: '#0284c7',
  Rental: '#2563eb',
  Gift: '#7c3aed',
  Refund: '#0d9488',
  Other: '#64748b',
};

/**
 * Escapes HTML special characters to prevent XSS in template strings.
 * @param {string} value
 * @returns {string}
 */
export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/**
 * Formats a number as USD currency.
 * @param {number} amount
 * @returns {string}
 */
export function formatCurrency(amount) {
  const numeric = Number(amount) || 0;
  const absFormatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Math.abs(numeric));
  return numeric < 0 ? `-${absFormatted}` : absFormatted;
}

/**
 * Formats an ISO YYYY-MM-DD date into a readable short label (e.g., Nov 13, 2026).
 * @param {string} isoDate
 * @returns {string}
 */
export function formatDate(isoDate) {
  if (!isoDate || !/^\d{4}-\d{2}-\d{2}$/.test(isoDate)) return isoDate || '—';
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Formats a YYYY-MM month key into a readable month label (e.g., November 2026).
 * @param {string} monthKey
 * @returns {string}
 */
export function formatMonthLabel(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return monthKey || '';
  const [y, m] = monthKey.split('-').map(Number);
  const dt = new Date(y, m - 1, 1);
  return dt.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Validates transaction form input and returns field errors if any.
 * @param {{ title: string, amount: string|number, category: string, type: string, date: string }} data
 * @returns {{ valid: boolean, errors: Record<string, string> }}
 */
export function validateTransactionInput(data) {
  const errors = {};
  const title = String(data.title || '').trim();
  const amountNum = Number(data.amount);
  const category = String(data.category || '').trim();
  const date = String(data.date || '').trim();

  if (!title) {
    errors.title = 'Please enter a transaction title.';
  } else if (title.length > 80) {
    errors.title = 'Title must be 80 characters or fewer.';
  }

  if (!Number.isFinite(amountNum) || amountNum <= 0) {
    errors.amount = 'Enter a valid amount greater than 0.';
  } else if (amountNum > 100000000) {
    errors.amount = 'Amount exceeds maximum supported limit.';
  }

  if (!category) {
    errors.category = 'Please select a category.';
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    errors.date = 'Please select a valid date.';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

/**
 * Dynamically computes overall and selected-month financial totals.
 * Total Balance = Total Income - Total Expenses.
 * @param {Array<object>} transactions
 * @param {string} activeMonth YYYY-MM
 */
export function computeFinancialSummary(transactions, activeMonth) {
  let totalIncome = 0;
  let totalExpenses = 0;
  let incomeCount = 0;
  let expenseCount = 0;
  let monthlyIncome = 0;
  let monthlyExpenses = 0;
  let monthlyExpenseCount = 0;

  for (const tx of transactions) {
    const amt = Number(tx.amount) || 0;
    const inActiveMonth = typeof tx.date === 'string' && tx.date.startsWith(activeMonth);

    if (tx.type === 'income') {
      totalIncome += amt;
      incomeCount += 1;
      if (inActiveMonth) {
        monthlyIncome += amt;
      }
    } else {
      totalExpenses += amt;
      expenseCount += 1;
      if (inActiveMonth) {
        monthlyExpenses += amt;
        monthlyExpenseCount += 1;
      }
    }
  }

  const totalBalance = totalIncome - totalExpenses;
  const monthlySavings = monthlyIncome - monthlyExpenses;
  const savingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
  const avgExpense = expenseCount > 0 ? totalExpenses / expenseCount : 0;

  return {
    totalIncome,
    totalExpenses,
    totalBalance,
    incomeCount,
    expenseCount,
    monthlyIncome,
    monthlyExpenses,
    monthlyExpenseCount,
    monthlySavings,
    savingsRate,
    avgExpense,
  };
}

/**
 * Computes category-wise totals sorted descending by amount.
 * @param {Array<object>} transactions
 * @param {'expense'|'income'} type
 * @param {string|null} monthKey Optional YYYY-MM filter
 * @returns {Array<{ category: string, amount: number, count: number, share: number, color: string }>}
 */
export function computeCategoryBreakdown(transactions, type = 'expense', monthKey = null) {
  const map = new Map();
  let grandTotal = 0;

  for (const tx of transactions) {
    if (tx.type !== type) continue;
    if (monthKey && (!tx.date || !tx.date.startsWith(monthKey))) continue;

    const amt = Number(tx.amount) || 0;
    grandTotal += amt;
    const prev = map.get(tx.category) || { category: tx.category, amount: 0, count: 0 };
    prev.amount += amt;
    prev.count += 1;
    map.set(tx.category, prev);
  }

  return Array.from(map.values())
    .map((entry) => ({
      ...entry,
      share: grandTotal > 0 ? (entry.amount / grandTotal) * 100 : 0,
      color: CATEGORY_COLORS[entry.category] || '#64748b',
    }))
    .sort((a, b) => b.amount - a.amount);
}

/**
 * Computes a continuous multi-month income vs expense series ending at anchorMonth.
 * @param {Array<object>} transactions
 * @param {string} anchorMonth YYYY-MM
 * @param {number} count Number of months
 * @returns {Array<{ monthKey: string, label: string, income: number, expense: number }>}
 */
export function computeMonthlySeries(transactions, anchorMonth, count = 6) {
  const [anchorY, anchorM] = anchorMonth.split('-').map(Number);
  const buckets = [];
  const bucketMap = new Map();

  for (let i = count - 1; i >= 0; i--) {
    const dt = new Date(anchorY, anchorM - 1 - i, 1);
    const key = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
    const label = dt.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    const entry = { monthKey: key, label, income: 0, expense: 0 };
    buckets.push(entry);
    bucketMap.set(key, entry);
  }

  for (const tx of transactions) {
    if (!tx.date || tx.date.length < 7) continue;
    const key = tx.date.slice(0, 7);
    const bucket = bucketMap.get(key);
    if (!bucket) continue;
    const amt = Number(tx.amount) || 0;
    if (tx.type === 'income') {
      bucket.income += amt;
    } else {
      bucket.expense += amt;
    }
  }

  return buckets;
}

/**
 * Filters and sorts transactions according to search, type, category, and sort order.
 * @param {Array<object>} transactions
 * @param {{ search: string, type: string, category: string, sort: string }} filters
 */
export function filterAndSortTransactions(transactions, filters) {
  const q = (filters.search || '').trim().toLowerCase();

  const filtered = transactions.filter((tx) => {
    if (filters.type !== 'all' && tx.type !== filters.type) return false;
    if (filters.category !== 'all' && tx.category !== filters.category) return false;
    if (q) {
      const hay = `${tx.title} ${tx.description || ''} ${tx.category}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  filtered.sort((a, b) => {
    switch (filters.sort) {
      case 'date-asc':
        return a.date.localeCompare(b.date) || a.title.localeCompare(b.title);
      case 'amount-desc':
        return b.amount - a.amount;
      case 'amount-asc':
        return a.amount - b.amount;
      case 'date-desc':
      default:
        return b.date.localeCompare(a.date) || a.title.localeCompare(b.title);
    }
  });

  return filtered;
}

/**
 * Renders the Transaction History view table and filter summary.
 */
export function renderTransactionsView(transactions, filterState, callbacks) {
  const categorySelect = document.getElementById('tx-category-filter');
  const wrap = document.getElementById('tx-history-table-wrap');
  const countEl = document.getElementById('tx-results-count');
  const incEl = document.getElementById('tx-filtered-income');
  const expEl = document.getElementById('tx-filtered-expense');
  const netEl = document.getElementById('tx-filtered-net');

  // Keep category filter options synchronized with existing categories + standard categories
  if (categorySelect) {
    const allCats = Array.from(
      new Set([...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...transactions.map((t) => t.category)])
    ).sort();
    const currentValue = filterState.category;
    categorySelect.innerHTML =
      '<option value="all">All Categories</option>' +
      allCats.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    categorySelect.value = allCats.includes(currentValue) || currentValue === 'all' ? currentValue : 'all';
  }

  const results = filterAndSortTransactions(transactions, filterState);

  let filteredIncome = 0;
  let filteredExpense = 0;
  for (const tx of results) {
    if (tx.type === 'income') filteredIncome += Number(tx.amount) || 0;
    else filteredExpense += Number(tx.amount) || 0;
  }

  if (countEl) {
    countEl.textContent = `${results.length} ${results.length === 1 ? 'transaction' : 'transactions'}`;
  }
  if (incEl) incEl.textContent = `+${formatCurrency(filteredIncome)}`;
  if (expEl) expEl.textContent = `-${formatCurrency(filteredExpense)}`;
  if (netEl) {
    const net = filteredIncome - filteredExpense;
    netEl.textContent = `Net: ${net >= 0 ? '' : '-'}${formatCurrency(Math.abs(net))}`;
  }

  if (!wrap) return;

  if (results.length === 0) {
    const hasFilters =
      filterState.search || filterState.type !== 'all' || filterState.category !== 'all';

    wrap.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon"><i data-lucide="receipt"></i></div>
        <h3 class="empty-state-title">${hasFilters ? 'No matching transactions' : 'No transactions yet'}</h3>
        <p class="empty-state-desc">
          ${
            hasFilters
              ? 'Try adjusting your search query or clearing active filters to view all entries.'
              : 'Record your first income or expense entry to start tracking your balance and spending.'
          }
        </p>
        <button type="button" class="btn btn-primary" id="tx-empty-action-btn">
          ${hasFilters ? 'Clear Filters' : 'Add Transaction'}
        </button>
      </div>
    `;
    const actionBtn = document.getElementById('tx-empty-action-btn');
    if (actionBtn) {
      actionBtn.addEventListener('click', () => {
        if (hasFilters) {
          callbacks.onResetFilters();
        } else {
          callbacks.onOpenAddModal();
        }
      });
    }
    return;
  }

  const rowsHtml = results
    .map((tx) => {
      const isIncome = tx.type === 'income';
      const sign = isIncome ? '+' : '-';
      const amountClass = isIncome ? 'text-income' : 'text-expense';
      const typeIcon = isIncome ? 'arrow-down-left' : 'arrow-up-right';
      const typeLabel = isIncome ? 'Income' : 'Expense';

      return `
        <tr>
          <td>
            <div class="tx-title-cell">
              <span class="tx-title-text">${escapeHtml(tx.title)}</span>
              ${tx.description ? `<span class="tx-desc-text">${escapeHtml(tx.description)}</span>` : ''}
            </div>
          </td>
          <td><span class="tx-category-text">${escapeHtml(tx.category)}</span></td>
          <td>
            <span class="tx-type-text ${amountClass}">
              <i data-lucide="${typeIcon}"></i>
              <span>${typeLabel}</span>
            </span>
          </td>
          <td><span class="tx-date-text">${formatDate(tx.date)}</span></td>
          <td class="col-right">
            <span class="tx-amount-text ${amountClass}">${sign}${formatCurrency(tx.amount)}</span>
          </td>
          <td class="col-right">
            <div class="row-actions">
              <button
                type="button"
                class="icon-btn"
                data-edit-id="${escapeHtml(tx.id)}"
                aria-label="Edit ${escapeHtml(tx.title)}"
                title="Edit"
              >
                <i data-lucide="pencil"></i>
              </button>
              <button
                type="button"
                class="icon-btn icon-btn-danger"
                data-delete-id="${escapeHtml(tx.id)}"
                aria-label="Delete ${escapeHtml(tx.title)}"
                title="Delete"
              >
                <i data-lucide="trash-2"></i>
              </button>
            </div>
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
          <th>Type</th>
          <th>Date</th>
          <th class="col-right">Amount</th>
          <th class="col-right">Actions</th>
        </tr>
      </thead>
      <tbody>${rowsHtml}</tbody>
    </table>
  `;

  wrap.querySelectorAll('[data-edit-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-edit-id');
      if (id) callbacks.onEdit(id);
    });
  });

  wrap.querySelectorAll('[data-delete-id]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.getAttribute('data-delete-id');
      if (id) callbacks.onDelete(id);
    });
  });
}

/**
 * Sets up the Add/Edit Transaction modal form and validation handlers.
 */
export function initTransactionModal(callbacks) {
  const modal = document.getElementById('tx-modal');
  const form = document.getElementById('tx-form');
  const titleHeading = document.getElementById('tx-modal-title');
  const submitBtn = document.getElementById('tx-submit-btn');
  const closeBtn = document.getElementById('tx-modal-close');
  const cancelBtn = document.getElementById('tx-modal-cancel');

  const idInput = document.getElementById('tx-id-input');
  const typeInput = document.getElementById('tx-type-input');
  const titleInput = document.getElementById('tx-title-input');
  const amountInput = document.getElementById('tx-amount-input');
  const categoryInput = document.getElementById('tx-category-input');
  const dateInput = document.getElementById('tx-date-input');
  const descInput = document.getElementById('tx-description-input');
  const typeButtons = modal ? modal.querySelectorAll('[data-tx-type]') : [];

  const errMap = {
    title: document.getElementById('err-tx-title'),
    amount: document.getElementById('err-tx-amount'),
    category: document.getElementById('err-tx-category'),
    date: document.getElementById('err-tx-date'),
  };

  function clearErrors() {
    Object.values(errMap).forEach((el) => {
      if (el) {
        el.textContent = '';
        el.classList.add('hidden');
      }
    });
    [titleInput, amountInput, categoryInput, dateInput].forEach((input) => {
      if (input) input.classList.remove('invalid');
    });
  }

  function populateCategories(type, selectedCategory = '') {
    if (!categoryInput) return;
    const list = type === 'income' ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
    const options = list.includes(selectedCategory) || !selectedCategory ? list : [selectedCategory, ...list];
    categoryInput.innerHTML = options
      .map((cat) => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`)
      .join('');
    if (selectedCategory && options.includes(selectedCategory)) {
      categoryInput.value = selectedCategory;
    }
  }

  function setTransactionType(type, selectedCategory = '') {
    if (typeInput) typeInput.value = type;
    typeButtons.forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-tx-type') === type);
    });
    populateCategories(type, selectedCategory);
  }

  function openModal(existingTx = null) {
    if (!modal) return;
    clearErrors();

    if (existingTx) {
      if (titleHeading) titleHeading.textContent = 'Edit Transaction';
      if (submitBtn) submitBtn.textContent = 'Update Transaction';
      idInput.value = existingTx.id;
      titleInput.value = existingTx.title;
      amountInput.value = String(existingTx.amount);
      dateInput.value = existingTx.date;
      descInput.value = existingTx.description || '';
      setTransactionType(existingTx.type, existingTx.category);
    } else {
      if (titleHeading) titleHeading.textContent = 'Add Transaction';
      if (submitBtn) submitBtn.textContent = 'Save Transaction';
      idInput.value = '';
      titleInput.value = '';
      amountInput.value = '';
      const now = new Date();
      const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
        now.getDate()
      ).padStart(2, '0')}`;
      dateInput.value = todayIso;
      descInput.value = '';
      setTransactionType('expense');
    }

    modal.hidden = false;
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => titleInput && titleInput.focus(), 20);
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute('aria-hidden', 'true');
  }

  typeButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextType = btn.getAttribute('data-tx-type') === 'income' ? 'income' : 'expense';
      setTransactionType(nextType);
    });
  });

  if (closeBtn) closeBtn.addEventListener('click', closeModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeModal);
  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeModal();
    });
  }

  if (form) {
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      clearErrors();

      const payload = {
        id: idInput.value.trim(),
        type: typeInput.value === 'income' ? 'income' : 'expense',
        title: titleInput.value,
        amount: amountInput.value,
        category: categoryInput.value,
        date: dateInput.value,
        description: descInput.value,
      };

      const validation = validateTransactionInput(payload);
      if (!validation.valid) {
        const inputLookup = {
          title: titleInput,
          amount: amountInput,
          category: categoryInput,
          date: dateInput,
        };
        for (const [field, msg] of Object.entries(validation.errors)) {
          if (errMap[field]) {
            errMap[field].textContent = msg;
            errMap[field].classList.remove('hidden');
          }
          if (inputLookup[field]) {
            inputLookup[field].classList.add('invalid');
          }
        }
        return;
      }

      callbacks.onSave(payload);
      closeModal();
    });
  }

  return {
    openAdd: () => openModal(null),
    openEdit: (tx) => openModal(tx),
    close: closeModal,
  };
}
