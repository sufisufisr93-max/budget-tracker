/**
 * app.js
 * Main application entry point. Coordinates state, navigation, modals, and module rendering.
 */

import {
  addTransaction,
  deleteTransaction,
  getBudget,
  getTransactions,
  resetToSampleData,
  saveBudget,
  seedInitialDataIfEmpty,
  toMonthKey,
  updateTransaction,
} from './storage.js';
import {
  filterAndSortTransactions,
  formatMonthLabel,
  initTransactionModal,
  renderTransactionsView,
} from './transactions.js';
import { renderDashboardView } from './dashboard.js';
import { renderAnalyticsView } from './analytics.js';
import { initBudgetControls, renderBudgetView } from './budget.js';

const VIEW_META = {
  dashboard: { title: 'Dashboard', subtitle: 'Financial overview' },
  transactions: { title: 'Transactions', subtitle: 'Manage and filter full history' },
  analytics: { title: 'Analytics', subtitle: 'Spending distribution & savings' },
  budget: { title: 'Budget', subtitle: 'Monthly spending limits & alerts' },
};

const appState = {
  activeView: 'dashboard',
  activeMonth: toMonthKey(new Date()),
  analyticsScope: 'month',
  txFilters: {
    search: '',
    type: 'all',
    category: 'all',
    sort: 'date-desc',
  },
};

let txModalApi = null;
let pendingConfirmAction = null;

function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === 'function') {
    window.lucide.createIcons();
  }
}

function showToast(message, iconName = 'check-circle-2') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i data-lucide="${iconName}"></i><span></span>`;
  const span = toast.querySelector('span');
  if (span) span.textContent = message;

  container.appendChild(toast);
  refreshIcons();

  setTimeout(() => {
    toast.remove();
  }, 3000);
}

function openConfirmModal({ title, message, confirmLabel = 'Confirm', onConfirm }) {
  const modal = document.getElementById('confirm-modal');
  const titleEl = document.getElementById('confirm-modal-title');
  const msgEl = document.getElementById('confirm-modal-message');
  const okBtn = document.getElementById('confirm-modal-ok');

  if (!modal) return;
  if (titleEl) titleEl.textContent = title;
  if (msgEl) msgEl.textContent = message;
  if (okBtn) okBtn.textContent = confirmLabel;

  pendingConfirmAction = onConfirm;
  modal.hidden = false;
  modal.setAttribute('aria-hidden', 'false');
}

function closeConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  if (!modal) return;
  modal.hidden = true;
  modal.setAttribute('aria-hidden', 'true');
  pendingConfirmAction = null;
}

function initConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  const closeBtn = document.getElementById('confirm-modal-close');
  const cancelBtn = document.getElementById('confirm-modal-cancel');
  const okBtn = document.getElementById('confirm-modal-ok');

  if (closeBtn) closeBtn.addEventListener('click', closeConfirmModal);
  if (cancelBtn) cancelBtn.addEventListener('click', closeConfirmModal);
  if (modal) {
    modal.addEventListener('click', (event) => {
      if (event.target === modal) closeConfirmModal();
    });
  }
  if (okBtn) {
    okBtn.addEventListener('click', () => {
      const fn = pendingConfirmAction;
      closeConfirmModal();
      if (typeof fn === 'function') fn();
    });
  }
}

function closeMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  if (sidebar) sidebar.classList.remove('is-open');
  if (backdrop) backdrop.classList.remove('is-open');
  if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
}

function openMobileSidebar() {
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  if (sidebar) sidebar.classList.add('is-open');
  if (backdrop) backdrop.classList.add('is-open');
  if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
}

function setActiveView(viewName) {
  if (!VIEW_META[viewName]) return;
  appState.activeView = viewName;

  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
    const isMatch = btn.getAttribute('data-view') === viewName;
    btn.classList.toggle('active', isMatch);
    if (isMatch) {
      btn.setAttribute('aria-current', 'page');
    } else {
      btn.removeAttribute('aria-current');
    }
  });

  document.querySelectorAll('.view-section').forEach((section) => {
    const isMatch = section.id === `view-${viewName}`;
    section.hidden = !isMatch;
    section.classList.toggle('active', isMatch);
  });

  const titleEl = document.getElementById('page-title');
  const subtitleEl = document.getElementById('page-subtitle');
  if (titleEl) titleEl.textContent = VIEW_META[viewName].title;
  if (subtitleEl) subtitleEl.textContent = VIEW_META[viewName].subtitle;

  closeMobileSidebar();
  renderCurrentView();
}

function renderCurrentView() {
  const transactions = getTransactions();
  const monthlyBudget = getBudget(appState.activeMonth);

  if (appState.activeView === 'dashboard') {
    renderDashboardView(transactions, appState.activeMonth, monthlyBudget, {
      onOpenAddModal: () => txModalApi.openAdd(),
      onNavigate: (view) => setActiveView(view),
    });
  } else if (appState.activeView === 'transactions') {
    renderTransactionsView(transactions, appState.txFilters, {
      onOpenAddModal: () => txModalApi.openAdd(),
      onEdit: (id) => {
        const tx = transactions.find((item) => item.id === id);
        if (tx) txModalApi.openEdit(tx);
      },
      onDelete: (id) => {
        const tx = transactions.find((item) => item.id === id);
        if (!tx) return;
        openConfirmModal({
          title: 'Delete Transaction',
          message: `Are you sure you want to delete "${tx.title}"? This action cannot be undone.`,
          confirmLabel: 'Delete',
          onConfirm: () => {
            deleteTransaction(id);
            renderCurrentView();
            showToast('Transaction deleted.', 'trash-2');
          },
        });
      },
      onResetFilters: () => {
        appState.txFilters = { search: '', type: 'all', category: 'all', sort: 'date-desc' };
        syncTransactionFilterInputs();
        renderCurrentView();
      },
    });
  } else if (appState.activeView === 'analytics') {
    renderAnalyticsView(transactions, appState.activeMonth, appState.analyticsScope);
  } else if (appState.activeView === 'budget') {
    renderBudgetView(transactions, appState.activeMonth, monthlyBudget);
  }

  refreshIcons();
}

function syncTransactionFilterInputs() {
  const searchEl = document.getElementById('tx-search-input');
  const catEl = document.getElementById('tx-category-filter');
  const sortEl = document.getElementById('tx-sort-select');
  if (searchEl) searchEl.value = appState.txFilters.search;
  if (catEl) catEl.value = appState.txFilters.category;
  if (sortEl) sortEl.value = appState.txFilters.sort;

  document.querySelectorAll('[data-type-filter]').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-type-filter') === appState.txFilters.type);
  });
}

function exportTransactionsCsv() {
  const transactions = filterAndSortTransactions(getTransactions(), {
    search: '',
    type: 'all',
    category: 'all',
    sort: 'date-desc',
  });

  if (transactions.length === 0) {
    showToast('No transactions available to export.', 'info');
    return;
  }

  const escapeCsv = (val) => `"${String(val ?? '').replaceAll('"', '""')}"`;
  const headers = ['ID', 'Date', 'Type', 'Title', 'Category', 'Amount', 'Description'];
  const rows = transactions.map((tx) => [
    escapeCsv(tx.id),
    escapeCsv(tx.date),
    escapeCsv(tx.type),
    escapeCsv(tx.title),
    escapeCsv(tx.category),
    tx.amount.toFixed(2),
    escapeCsv(tx.description),
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `ledgerflow-transactions-${toMonthKey(new Date())}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  showToast('Transactions exported to CSV.');
}

function bootstrapApp() {
  // Initialize LocalStorage sample dataset once on first load
  seedInitialDataIfEmpty();

  // Month picker initialization
  const monthPicker = document.getElementById('global-month-picker');
  if (monthPicker) {
    monthPicker.value = appState.activeMonth;
    monthPicker.addEventListener('change', () => {
      if (monthPicker.value) {
        appState.activeMonth = monthPicker.value;
        renderCurrentView();
      }
    });
  }

  // Transaction modal setup
  txModalApi = initTransactionModal({
    onSave: (payload) => {
      if (payload.id) {
        updateTransaction(payload.id, payload);
        showToast('Transaction updated.');
      } else {
        addTransaction(payload);
        showToast('Transaction added.');
      }
      renderCurrentView();
    },
  });

  // Confirm modal setup
  initConfirmModal();

  // Budget controls setup
  initBudgetControls({
    onSaveBudget: (amount) => {
      saveBudget(appState.activeMonth, amount);
      renderCurrentView();
      showToast(`Budget updated for ${formatMonthLabel(appState.activeMonth)}.`);
    },
    onClearBudget: () => {
      saveBudget(appState.activeMonth, null);
      renderCurrentView();
      showToast(`Budget cleared for ${formatMonthLabel(appState.activeMonth)}.`);
    },
  });

  // Topbar & Dashboard navigation triggers
  const addBtn = document.getElementById('open-add-modal-btn');
  if (addBtn) addBtn.addEventListener('click', () => txModalApi.openAdd());

  const dashViewAllBtn = document.getElementById('dash-view-all-btn');
  if (dashViewAllBtn) dashViewAllBtn.addEventListener('click', () => setActiveView('transactions'));

  // Sidebar navigation
  document.querySelectorAll('.nav-item[data-view]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const target = btn.getAttribute('data-view');
      if (target) setActiveView(target);
    });
  });

  const brandLink = document.querySelector('.brand-mark[data-nav]');
  if (brandLink) {
    brandLink.addEventListener('click', (e) => {
      e.preventDefault();
      setActiveView('dashboard');
    });
  }

  // Mobile sidebar drawer controls
  const toggleBtn = document.getElementById('sidebar-toggle-btn');
  const closeSidebarBtn = document.getElementById('sidebar-close-btn');
  const backdrop = document.getElementById('sidebar-backdrop');
  if (toggleBtn) toggleBtn.addEventListener('click', openMobileSidebar);
  if (closeSidebarBtn) closeSidebarBtn.addEventListener('click', closeMobileSidebar);
  if (backdrop) backdrop.addEventListener('click', closeMobileSidebar);

  // Sidebar utilities
  const exportBtn = document.getElementById('export-csv-btn');
  if (exportBtn) exportBtn.addEventListener('click', exportTransactionsCsv);

  const resetBtn = document.getElementById('reset-demo-btn');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      openConfirmModal({
        title: 'Reset Sample Data',
        message:
          'This will replace your current transactions and budgets with the default sample dataset. Continue?',
        confirmLabel: 'Reset Data',
        onConfirm: () => {
          resetToSampleData();
          appState.activeMonth = toMonthKey(new Date());
          if (monthPicker) monthPicker.value = appState.activeMonth;
          renderCurrentView();
          showToast('Sample dataset restored.');
        },
      });
    });
  }

  // Transaction History filter & sort listeners
  const searchInput = document.getElementById('tx-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', () => {
      appState.txFilters.search = searchInput.value;
      renderCurrentView();
    });
  }

  document.querySelectorAll('[data-type-filter]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextType = btn.getAttribute('data-type-filter') || 'all';
      appState.txFilters.type = nextType;
      syncTransactionFilterInputs();
      renderCurrentView();
    });
  });

  const categoryFilter = document.getElementById('tx-category-filter');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', () => {
      appState.txFilters.category = categoryFilter.value;
      renderCurrentView();
    });
  }

  const sortSelect = document.getElementById('tx-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', () => {
      appState.txFilters.sort = sortSelect.value;
      renderCurrentView();
    });
  }

  // Analytics period scope toggle
  document.querySelectorAll('[data-analytics-scope]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const nextScope = btn.getAttribute('data-analytics-scope') === 'all' ? 'all' : 'month';
      appState.analyticsScope = nextScope;
      document.querySelectorAll('[data-analytics-scope]').forEach((b) => {
        b.classList.toggle('active', b.getAttribute('data-analytics-scope') === nextScope);
      });
      renderCurrentView();
    });
  });

  // Escape key closes modals / mobile drawer
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      txModalApi.close();
      closeConfirmModal();
      closeMobileSidebar();
    }
  });

  // Initial render
  setActiveView('dashboard');
}

document.addEventListener('DOMContentLoaded', bootstrapApp);
