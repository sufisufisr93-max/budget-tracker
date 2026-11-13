/**
 * storage.js
 * Centralized persistence layer wrapping LocalStorage.
 *
 * Future Backend Integration Note:
 * All data access passes through this module. When migrating to Node.js + Express + SQL,
 * replace these synchronous LocalStorage operations with fetch('/api/...') REST calls
 * while keeping UI and calculation modules unchanged.
 */

const TRANSACTIONS_KEY = 'ledgerflow_transactions_v1';
const BUDGETS_KEY = 'ledgerflow_budgets_v1';
const INITIALIZED_KEY = 'ledgerflow_initialized_v1';

/**
 * Generates a unique identifier for new transactions.
 * @returns {string}
 */
export function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `tx_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Formats a Date object as YYYY-MM-DD in local time.
 * @param {Date} date
 * @returns {string}
 */
function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formats a Date object as YYYY-MM in local time.
 * @param {Date} date
 * @returns {string}
 */
export function toMonthKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * Builds realistic initial sample transactions relative to the current date
 * so first-time users can explore charts, filters, and budget tracking right away.
 * @returns {Array<object>}
 */
export function buildSampleTransactions() {
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth();

  const d = (monthOffset, day) => {
    const dt = new Date(y, m + monthOffset, Math.min(day, 28));
    return toIsoDate(dt);
  };

  return [
    {
      id: generateId(),
      title: 'Monthly Salary',
      amount: 5400,
      category: 'Salary',
      type: 'income',
      date: d(0, 1),
      description: 'Primary engineering payroll deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: d(0, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Whole Foods Market',
      amount: 168.4,
      category: 'Food',
      type: 'expense',
      date: d(0, 4),
      description: 'Weekly groceries and produce',
    },
    {
      id: generateId(),
      title: 'Electric & Fiber Internet',
      amount: 142.8,
      category: 'Utilities',
      type: 'expense',
      date: d(0, 6),
      description: 'Monthly power and internet bill',
    },
    {
      id: generateId(),
      title: 'UI Design Advisory',
      amount: 850,
      category: 'Freelance',
      type: 'income',
      date: d(0, 8),
      description: 'Client product architecture review',
    },
    {
      id: generateId(),
      title: 'Metro Transit Pass',
      amount: 96,
      category: 'Transport',
      type: 'expense',
      date: d(0, 9),
      description: 'Monthly commuter rail pass',
    },
    {
      id: generateId(),
      title: 'Grocery Shopping',
      amount: 134.25,
      category: 'Food',
      type: 'expense',
      date: d(0, 11),
      description: 'Household essentials and pantry restock',
    },
    {
      id: generateId(),
      title: 'Dental Checkup',
      amount: 185,
      category: 'Healthcare',
      type: 'expense',
      date: d(0, 12),
      description: 'Routine cleaning co-pay',
    },
    // Previous Month (-1)
    {
      id: generateId(),
      title: 'Monthly Salary',
      amount: 5400,
      category: 'Salary',
      type: 'income',
      date: d(-1, 1),
      description: 'Primary engineering payroll deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: d(-1, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Grocery & Dining',
      amount: 420.5,
      category: 'Food',
      type: 'expense',
      date: d(-1, 10),
      description: 'Monthly food and dining expenses',
    },
    {
      id: generateId(),
      title: 'Utilities & Mobile',
      amount: 175,
      category: 'Utilities',
      type: 'expense',
      date: d(-1, 15),
      description: 'Power, water, and mobile plan',
    },
    {
      id: generateId(),
      title: 'Running Shoes & Gear',
      amount: 210,
      category: 'Shopping',
      type: 'expense',
      date: d(-1, 21),
      description: 'Athletic apparel replacement',
    },
    // Two Months Ago (-2)
    {
      id: generateId(),
      title: 'Monthly Salary',
      amount: 5400,
      category: 'Salary',
      type: 'income',
      date: d(-2, 1),
      description: 'Primary engineering payroll deposit',
    },
    {
      id: generateId(),
      title: 'Dividend Payout',
      amount: 320,
      category: 'Investments',
      type: 'income',
      date: d(-2, 14),
      description: 'Quarterly index fund distribution',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: d(-2, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Groceries & Produce',
      amount: 388,
      category: 'Food',
      type: 'expense',
      date: d(-2, 12),
      description: 'Supermarket runs',
    },
    {
      id: generateId(),
      title: 'Online Course Subscription',
      amount: 149,
      category: 'Education',
      type: 'expense',
      date: d(-2, 19),
      description: 'Systems architecture workshop',
    },
    // Three Months Ago (-3)
    {
      id: generateId(),
      title: 'Monthly Salary',
      amount: 5200,
      category: 'Salary',
      type: 'income',
      date: d(-3, 1),
      description: 'Monthly payroll deposit',
    },
    {
      id: generateId(),
      title: 'Apartment Rent',
      amount: 1450,
      category: 'Housing',
      type: 'expense',
      date: d(-3, 2),
      description: 'Monthly lease payment',
    },
    {
      id: generateId(),
      title: 'Concert & Cinema',
      amount: 165,
      category: 'Entertainment',
      type: 'expense',
      date: d(-3, 18),
      description: 'Weekend tickets',
    },
    {
      id: generateId(),
      title: 'Groceries',
      amount: 410,
      category: 'Food',
      type: 'expense',
      date: d(-3, 20),
      description: 'Monthly groceries',
    },
  ];
}

/**
 * Initializes LocalStorage once on first visit.
 * Deleting all transactions afterward keeps storage empty across reloads.
 */
export function seedInitialDataIfEmpty() {
  const isInitialized = localStorage.getItem(INITIALIZED_KEY);
  if (isInitialized === null) {
    const sampleTransactions = buildSampleTransactions();
    const currentMonth = toMonthKey(new Date());
    saveTransactions(sampleTransactions);
    saveBudget(currentMonth, 3000);
    localStorage.setItem(INITIALIZED_KEY, 'true');
  }
}

/**
 * Resets LocalStorage to the curated sample dataset.
 */
export function resetToSampleData() {
  const sampleTransactions = buildSampleTransactions();
  const currentMonth = toMonthKey(new Date());
  saveTransactions(sampleTransactions);
  localStorage.setItem(BUDGETS_KEY, JSON.stringify({ [currentMonth]: 3000 }));
  localStorage.setItem(INITIALIZED_KEY, 'true');
}

/**
 * Retrieves all transactions from LocalStorage.
 * @returns {Array<object>}
 */
export function getTransactions() {
  try {
    const raw = localStorage.getItem(TRANSACTIONS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error('Failed to read transactions from LocalStorage:', error);
    return [];
  }
}

/**
 * Persists the complete transactions array to LocalStorage.
 * @param {Array<object>} transactions
 */
export function saveTransactions(transactions) {
  localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(transactions));
}

/**
 * Adds a new transaction and persists it.
 * @param {{ title: string, amount: number, category: string, type: 'income'|'expense', date: string, description: string }} data
 * @returns {object}
 */
export function addTransaction(data) {
  const transactions = getTransactions();
  const newTx = {
    id: generateId(),
    title: String(data.title).trim(),
    amount: Number(Number(data.amount).toFixed(2)),
    category: String(data.category),
    type: data.type === 'income' ? 'income' : 'expense',
    date: String(data.date),
    description: String(data.description || '').trim(),
  };
  transactions.push(newTx);
  saveTransactions(transactions);
  return newTx;
}

/**
 * Updates an existing transaction by id.
 * @param {string} id
 * @param {object} updates
 * @returns {object|null}
 */
export function updateTransaction(id, updates) {
  const transactions = getTransactions();
  const idx = transactions.findIndex((tx) => tx.id === id);
  if (idx === -1) return null;

  const updated = {
    ...transactions[idx],
    title: String(updates.title).trim(),
    amount: Number(Number(updates.amount).toFixed(2)),
    category: String(updates.category),
    type: updates.type === 'income' ? 'income' : 'expense',
    date: String(updates.date),
    description: String(updates.description || '').trim(),
  };
  transactions[idx] = updated;
  saveTransactions(transactions);
  return updated;
}

/**
 * Deletes a transaction by id.
 * @param {string} id
 * @returns {boolean}
 */
export function deleteTransaction(id) {
  const transactions = getTransactions();
  const next = transactions.filter((tx) => tx.id !== id);
  if (next.length === transactions.length) return false;
  saveTransactions(next);
  return true;
}

/**
 * Retrieves all saved monthly budgets keyed by YYYY-MM.
 * @returns {Record<string, number>}
 */
export function getAllBudgets() {
  try {
    const raw = localStorage.getItem(BUDGETS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (error) {
    console.error('Failed to read budgets from LocalStorage:', error);
    return {};
  }
}

/**
 * Retrieves the monthly budget limit for a given YYYY-MM month key.
 * @param {string} monthKey
 * @returns {number|null}
 */
export function getBudget(monthKey) {
  const budgets = getAllBudgets();
  const val = budgets[monthKey];
  return typeof val === 'number' && val > 0 ? val : null;
}

/**
 * Saves or clears a monthly budget limit for a given YYYY-MM month key.
 * @param {string} monthKey
 * @param {number|null} amount
 */
export function saveBudget(monthKey, amount) {
  const budgets = getAllBudgets();
  if (amount === null || amount === undefined || amount <= 0) {
    delete budgets[monthKey];
  } else {
    budgets[monthKey] = Number(Number(amount).toFixed(2));
  }
  localStorage.setItem(BUDGETS_KEY, JSON.stringify(budgets));
}
