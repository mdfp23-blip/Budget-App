const DEFAULT_STATE = {
  categories: [
    { id: crypto.randomUUID(), name: "Housing", limit: 1200 },
    { id: crypto.randomUUID(), name: "Food", limit: 500 },
    { id: crypto.randomUUID(), name: "Transport", limit: 250 },
    { id: crypto.randomUUID(), name: "Utilities", limit: 300 },
  ],
  goals: [{ id: crypto.randomUUID(), name: "Emergency Fund", target: 5000, saved: 1200 }],
  bills: [
    { id: crypto.randomUUID(), name: "Rent", amount: 1000, day: 1, categoryId: null },
    { id: crypto.randomUUID(), name: "Internet", amount: 60, day: 9, categoryId: null },
  ],
  transactions: [
    {
      id: crypto.randomUUID(),
      date: new Date().toISOString().slice(0, 10),
      type: "income",
      categoryId: null,
      amount: 3200,
      description: "Monthly Salary",
    },
  ],
  filterMonth: new Date().toISOString().slice(0, 7),
};

class BudgetApp {
  constructor() {
    this.storageKey = "budgetflow_state_v1";
    this.state = this.loadState();
    this.categoryChart = null;
    this.trendChart = null;

    this.cacheElements();
    this.attachEvents();
    this.refreshCategorySelectors();
    this.render();
  }

  cacheElements() {
    this.views = document.querySelectorAll(".view");
    this.tabs = document.querySelectorAll(".tab-btn");

    this.metricIncome = document.querySelector("#metric-income");
    this.metricExpenses = document.querySelector("#metric-expenses");
    this.metricNet = document.querySelector("#metric-net");
    this.metricBudgetRemaining = document.querySelector("#metric-budget-remaining");

    this.budgetStatusList = document.querySelector("#budget-status-list");
    this.goalProgressList = document.querySelector("#goal-progress-list");

    this.transactionForm = document.querySelector("#transaction-form");
    this.txId = document.querySelector("#transaction-id");
    this.txDate = document.querySelector("#tx-date");
    this.txType = document.querySelector("#tx-type");
    this.txCategory = document.querySelector("#tx-category");
    this.txAmount = document.querySelector("#tx-amount");
    this.txDescription = document.querySelector("#tx-description");
    this.txCancel = document.querySelector("#tx-cancel-edit");
    this.txSubmitBtn = document.querySelector("#tx-submit-btn");
    this.monthFilter = document.querySelector("#month-filter");
    this.transactionsList = document.querySelector("#transactions-list");

    this.categoryForm = document.querySelector("#category-form");
    this.categoryName = document.querySelector("#category-name");
    this.categoryLimit = document.querySelector("#category-limit");
    this.categoriesList = document.querySelector("#categories-list");

    this.goalForm = document.querySelector("#goal-form");
    this.goalName = document.querySelector("#goal-name");
    this.goalTarget = document.querySelector("#goal-target");
    this.goalsList = document.querySelector("#goals-list");

    this.billForm = document.querySelector("#bill-form");
    this.billName = document.querySelector("#bill-name");
    this.billAmount = document.querySelector("#bill-amount");
    this.billDay = document.querySelector("#bill-day");
    this.billCategory = document.querySelector("#bill-category");
    this.billsList = document.querySelector("#bills-list");

    this.categoryCanvas = document.querySelector("#category-chart");
    this.trendCanvas = document.querySelector("#trend-chart");

    this.monthFilter.value = this.state.filterMonth;
    this.txDate.value = new Date().toISOString().slice(0, 10);
  }

  attachEvents() {
    this.tabs.forEach((tab) => {
      tab.addEventListener("click", () => this.switchView(tab.dataset.view));
    });

    this.transactionForm.addEventListener("submit", (event) => {
      event.preventDefault();
      this.upsertTransaction();
    });

    this.txCancel.addEventListener("click", () => this.resetTransactionForm());

    this.monthFilter.addEventListener("change", () => {
      this.state.filterMonth = this.monthFilter.value || new Date().toISOString().slice(0, 7);
      this.saveState();
      this.render();
    });

    this.categoryForm.addEventListener("submit", (event) => {
      event.preventDefault();
      this.addCategory();
    });

    this.goalForm.addEventListener("submit", (event) => {
      event.preventDefault();
      this.addGoal();
    });

    this.billForm.addEventListener("submit", (event) => {
      event.preventDefault();
      this.addBill();
    });

    this.categoriesList.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const { action, id } = button.dataset;

      if (action === "delete") this.deleteCategory(id);
      if (action === "edit") this.editCategoryLimit(id);
    });

    this.goalsList.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const { action, id } = button.dataset;

      if (action === "delete") this.deleteGoal(id);
      if (action === "update") this.updateGoalProgress(id);
    });

    this.billsList.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const { action, id } = button.dataset;

      if (action === "delete") this.deleteBill(id);
      if (action === "record") this.recordBill(id);
    });

    this.transactionsList.addEventListener("click", (event) => {
      const button = event.target.closest("button[data-action]");
      if (!button) return;
      const { action, id } = button.dataset;

      if (action === "delete") this.deleteTransaction(id);
      if (action === "edit") this.startTransactionEdit(id);
    });
  }

  loadState() {
    const raw = localStorage.getItem(this.storageKey);
    if (!raw) return structuredClone(DEFAULT_STATE);

    try {
      const parsed = JSON.parse(raw);
      return {
        ...structuredClone(DEFAULT_STATE),
        ...parsed,
      };
    } catch {
      return structuredClone(DEFAULT_STATE);
    }
  }

  saveState() {
    localStorage.setItem(this.storageKey, JSON.stringify(this.state));
  }

  currency(value) {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value || 0);
  }

  getCategoryName(categoryId) {
    if (!categoryId) return "Uncategorized";
    const match = this.state.categories.find((item) => item.id === categoryId);
    return match ? match.name : "Uncategorized";
  }

  refreshCategorySelectors() {
    const buildOptions = () => {
      const options = ["<option value=''>Uncategorized</option>"];
      this.state.categories.forEach((category) => {
        options.push(`<option value="${category.id}">${category.name}</option>`);
      });
      return options.join("");
    };

    this.txCategory.innerHTML = buildOptions();
    this.billCategory.innerHTML = buildOptions();
  }

  getFilteredTransactions() {
    return this.state.transactions
      .filter((tx) => tx.date.startsWith(this.state.filterMonth))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  }

  getDashboardStats() {
    const filtered = this.getFilteredTransactions();
    const income = filtered.filter((tx) => tx.type === "income").reduce((sum, tx) => sum + Number(tx.amount), 0);
    const expenses = filtered.filter((tx) => tx.type === "expense").reduce((sum, tx) => sum + Number(tx.amount), 0);

    const totalBudget = this.state.categories.reduce((sum, category) => sum + Number(category.limit), 0);
    const remaining = totalBudget - expenses;

    return { income, expenses, net: income - expenses, remaining, filtered };
  }

  switchView(viewId) {
    this.views.forEach((view) => view.classList.toggle("active", view.id === viewId));
    this.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.view === viewId));
  }

  render() {
    this.renderSummary();
    this.renderTransactions();
    this.renderCategories();
    this.renderGoals();
    this.renderBills();
    this.renderBudgetStatus();
    this.renderGoalProgress();
    this.renderCharts();
  }

  renderSummary() {
    const { income, expenses, net, remaining } = this.getDashboardStats();
    this.metricIncome.textContent = this.currency(income);
    this.metricExpenses.textContent = this.currency(expenses);
    this.metricNet.textContent = this.currency(net);
    this.metricBudgetRemaining.textContent = this.currency(remaining);
    this.metricNet.classList.toggle("bad", net < 0);
    this.metricBudgetRemaining.classList.toggle("bad", remaining < 0);
  }

  renderTransactions() {
    const filtered = this.getFilteredTransactions();
    if (!filtered.length) {
      this.transactionsList.innerHTML = `<p class="item-subtle">No transactions for ${this.state.filterMonth}.</p>`;
      return;
    }

    this.transactionsList.innerHTML = filtered
      .map(
        (tx) => `
          <article class="list-item">
            <div class="item-main">
              <strong>${this.escapeHtml(tx.description || this.getCategoryName(tx.categoryId))}</strong>
              <span class="item-subtle">${tx.date} • ${tx.type.toUpperCase()} • ${this.getCategoryName(tx.categoryId)}</span>
            </div>
            <div class="item-actions">
              <strong class="${tx.type === "expense" ? "bad" : "good"}">${tx.type === "expense" ? "-" : "+"}${this.currency(tx.amount)}</strong>
              <button class="small-btn" data-action="edit" data-id="${tx.id}">Edit</button>
              <button class="danger-btn" data-action="delete" data-id="${tx.id}">Delete</button>
            </div>
          </article>
        `,
      )
      .join("");
  }

  renderCategories() {
    if (!this.state.categories.length) {
      this.categoriesList.innerHTML = '<p class="item-subtle">Add your first budget category.</p>';
      return;
    }

    this.categoriesList.innerHTML = this.state.categories
      .map(
        (category) => `
          <article class="list-item">
            <div class="item-main">
              <strong>${this.escapeHtml(category.name)}</strong>
              <span class="item-subtle">Monthly limit: ${this.currency(category.limit)}</span>
            </div>
            <div class="item-actions">
              <button class="small-btn" data-action="edit" data-id="${category.id}">Edit Limit</button>
              <button class="danger-btn" data-action="delete" data-id="${category.id}">Delete</button>
            </div>
          </article>
        `,
      )
      .join("");
  }

  renderGoals() {
    if (!this.state.goals.length) {
      this.goalsList.innerHTML = '<p class="item-subtle">Add savings goals to track progress.</p>';
      return;
    }

    this.goalsList.innerHTML = this.state.goals
      .map((goal) => {
        const progress = Math.min(100, (goal.saved / goal.target) * 100);
        return `
          <article class="list-item">
            <div class="item-main">
              <strong>${this.escapeHtml(goal.name)}</strong>
              <span class="item-subtle">${this.currency(goal.saved)} / ${this.currency(goal.target)}</span>
              <div class="progress-wrap"><div class="progress-bar" style="width:${progress}%"></div></div>
            </div>
            <div class="item-actions">
              <button class="small-btn" data-action="update" data-id="${goal.id}">Add Progress</button>
              <button class="danger-btn" data-action="delete" data-id="${goal.id}">Delete</button>
            </div>
          </article>
        `;
      })
      .join("");
  }

  renderBills() {
    if (!this.state.bills.length) {
      this.billsList.innerHTML = '<p class="item-subtle">No recurring bills yet.</p>';
      return;
    }

    this.billsList.innerHTML = this.state.bills
      .map(
        (bill) => `
          <article class="list-item">
            <div class="item-main">
              <strong>${this.escapeHtml(bill.name)}</strong>
              <span class="item-subtle">${this.currency(bill.amount)} due on day ${bill.day} • ${this.getCategoryName(bill.categoryId)}</span>
            </div>
            <div class="item-actions">
              <button class="small-btn" data-action="record" data-id="${bill.id}">Record as Paid</button>
              <button class="danger-btn" data-action="delete" data-id="${bill.id}">Delete</button>
            </div>
          </article>
        `,
      )
      .join("");
  }

  renderBudgetStatus() {
    const filteredExpenses = this.getFilteredTransactions().filter((tx) => tx.type === "expense");
    const byCategory = filteredExpenses.reduce((acc, tx) => {
      const key = tx.categoryId || "uncategorized";
      acc[key] = (acc[key] || 0) + Number(tx.amount);
      return acc;
    }, {});

    if (!this.state.categories.length) {
      this.budgetStatusList.innerHTML = '<p class="item-subtle">No categories to show status.</p>';
      return;
    }

    this.budgetStatusList.innerHTML = this.state.categories
      .map((category) => {
        const spent = byCategory[category.id] || 0;
        const ratio = category.limit > 0 ? (spent / category.limit) * 100 : 0;
        const statusClass = ratio > 100 ? "bad" : "good";
        return `<article class="list-item"><div class="item-main"><strong>${this.escapeHtml(category.name)}</strong><span class="item-subtle ${statusClass}">${this.currency(spent)} of ${this.currency(category.limit)} (${ratio.toFixed(0)}%)</span></div></article>`;
      })
      .join("");
  }

  renderGoalProgress() {
    if (!this.state.goals.length) {
      this.goalProgressList.innerHTML = '<p class="item-subtle">No savings goals yet.</p>';
      return;
    }

    this.goalProgressList.innerHTML = this.state.goals
      .map((goal) => {
        const ratio = (goal.saved / goal.target) * 100;
        return `<article class="list-item"><div class="item-main"><strong>${this.escapeHtml(goal.name)}</strong><span class="item-subtle ${ratio >= 100 ? "good" : ""}">${ratio.toFixed(1)}% complete</span><div class="progress-wrap"><div class="progress-bar" style="width:${Math.min(
          ratio,
          100,
        )}%"></div></div></div></article>`;
      })
      .join("");
  }

  renderCharts() {
    const filteredExpenses = this.getFilteredTransactions().filter((tx) => tx.type === "expense");
    const categoryTotals = filteredExpenses.reduce((acc, tx) => {
      const label = this.getCategoryName(tx.categoryId);
      acc[label] = (acc[label] || 0) + Number(tx.amount);
      return acc;
    }, {});

    const categoryLabels = Object.keys(categoryTotals);
    const categoryValues = Object.values(categoryTotals);

    if (this.categoryChart) this.categoryChart.destroy();
    this.categoryChart = new Chart(this.categoryCanvas, {
      type: "doughnut",
      data: {
        labels: categoryLabels.length ? categoryLabels : ["No expenses"],
        datasets: [
          {
            data: categoryValues.length ? categoryValues : [1],
            backgroundColor: ["#2563eb", "#14b8a6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4"],
          },
        ],
      },
      options: { plugins: { legend: { position: "bottom" } } },
    });

    const byMonth = {};
    this.state.transactions.forEach((tx) => {
      const month = tx.date.slice(0, 7);
      if (!byMonth[month]) byMonth[month] = { income: 0, expense: 0 };
      byMonth[month][tx.type] += Number(tx.amount);
    });

    const months = Object.keys(byMonth).sort();
    if (this.trendChart) this.trendChart.destroy();
    this.trendChart = new Chart(this.trendCanvas, {
      type: "line",
      data: {
        labels: months,
        datasets: [
          {
            label: "Income",
            data: months.map((month) => byMonth[month].income),
            borderColor: "#16a34a",
            backgroundColor: "rgba(22,163,74,0.2)",
            tension: 0.3,
          },
          {
            label: "Expenses",
            data: months.map((month) => byMonth[month].expense),
            borderColor: "#dc2626",
            backgroundColor: "rgba(220,38,38,0.2)",
            tension: 0.3,
          },
        ],
      },
      options: {
        scales: {
          y: {
            ticks: {
              callback: (value) => `$${value}`,
            },
          },
        },
      },
    });
  }

  upsertTransaction() {
    const payload = {
      id: this.txId.value || crypto.randomUUID(),
      date: this.txDate.value,
      type: this.txType.value,
      categoryId: this.txCategory.value || null,
      amount: Number(this.txAmount.value),
      description: this.txDescription.value.trim(),
    };

    if (!payload.date || !payload.type || payload.amount <= 0) return;

    const existingIndex = this.state.transactions.findIndex((tx) => tx.id === payload.id);
    if (existingIndex >= 0) {
      this.state.transactions[existingIndex] = payload;
    } else {
      this.state.transactions.push(payload);
    }

    this.saveState();
    this.resetTransactionForm();
    this.render();
  }

  startTransactionEdit(id) {
    const tx = this.state.transactions.find((item) => item.id === id);
    if (!tx) return;

    this.txId.value = tx.id;
    this.txDate.value = tx.date;
    this.txType.value = tx.type;
    this.txCategory.value = tx.categoryId || "";
    this.txAmount.value = tx.amount;
    this.txDescription.value = tx.description || "";
    this.txSubmitBtn.textContent = "Update Transaction";
    this.txCancel.classList.remove("hidden");
    this.switchView("transactions");
  }

  resetTransactionForm() {
    this.transactionForm.reset();
    this.txId.value = "";
    this.txDate.value = new Date().toISOString().slice(0, 10);
    this.txType.value = "expense";
    this.txCategory.value = "";
    this.txSubmitBtn.textContent = "Save Transaction";
    this.txCancel.classList.add("hidden");
  }

  deleteTransaction(id) {
    this.state.transactions = this.state.transactions.filter((tx) => tx.id !== id);
    this.saveState();
    this.render();
  }

  addCategory() {
    const name = this.categoryName.value.trim();
    const limit = Number(this.categoryLimit.value);
    if (!name || limit < 0) return;

    this.state.categories.push({ id: crypto.randomUUID(), name, limit });
    this.categoryForm.reset();
    this.saveState();
    this.refreshCategorySelectors();
    this.render();
  }

  editCategoryLimit(id) {
    const category = this.state.categories.find((item) => item.id === id);
    if (!category) return;

    const nextLimit = Number(prompt(`Set monthly limit for ${category.name}`, String(category.limit)));
    if (Number.isNaN(nextLimit) || nextLimit < 0) return;

    category.limit = nextLimit;
    this.saveState();
    this.render();
  }

  deleteCategory(id) {
    this.state.categories = this.state.categories.filter((item) => item.id !== id);
    this.state.transactions = this.state.transactions.map((tx) => (tx.categoryId === id ? { ...tx, categoryId: null } : tx));
    this.state.bills = this.state.bills.map((bill) => (bill.categoryId === id ? { ...bill, categoryId: null } : bill));

    this.saveState();
    this.refreshCategorySelectors();
    this.render();
  }

  addGoal() {
    const name = this.goalName.value.trim();
    const target = Number(this.goalTarget.value);
    if (!name || target <= 0) return;

    this.state.goals.push({ id: crypto.randomUUID(), name, target, saved: 0 });
    this.goalForm.reset();
    this.saveState();
    this.render();
  }

  updateGoalProgress(id) {
    const goal = this.state.goals.find((item) => item.id === id);
    if (!goal) return;

    const delta = Number(prompt(`Add progress amount for ${goal.name}`, "0"));
    if (Number.isNaN(delta) || delta === 0) return;

    goal.saved = Math.max(0, goal.saved + delta);
    this.saveState();
    this.render();
  }

  deleteGoal(id) {
    this.state.goals = this.state.goals.filter((goal) => goal.id !== id);
    this.saveState();
    this.render();
  }

  addBill() {
    const name = this.billName.value.trim();
    const amount = Number(this.billAmount.value);
    const day = Number(this.billDay.value);

    if (!name || amount <= 0 || day < 1 || day > 31) return;

    this.state.bills.push({
      id: crypto.randomUUID(),
      name,
      amount,
      day,
      categoryId: this.billCategory.value || null,
    });

    this.billForm.reset();
    this.saveState();
    this.render();
  }

  recordBill(id) {
    const bill = this.state.bills.find((item) => item.id === id);
    if (!bill) return;

    const today = new Date().toISOString().slice(0, 10);
    this.state.transactions.push({
      id: crypto.randomUUID(),
      date: today,
      type: "expense",
      categoryId: bill.categoryId,
      amount: Number(bill.amount),
      description: `${bill.name} (Recurring Bill)`,
    });

    this.saveState();
    this.render();
    this.switchView("transactions");
  }

  deleteBill(id) {
    this.state.bills = this.state.bills.filter((bill) => bill.id !== id);
    this.saveState();
    this.render();
  }

  escapeHtml(value) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }
}

window.addEventListener("DOMContentLoaded", () => {
  new BudgetApp();
});
