(() => {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const KEYS = {
    data: "spendwise_v1_data",
    users: "spendwise_v1_users",
    session: "spendwise_v1_session",
  };
  const CATEGORIES = [
    "Food & dining",
    "Groceries",
    "Shopping",
    "Travel",
    "Education",
    "Entertainment",
    "Bills & utilities",
    "Personal care",
    "Health",
    "Other",
  ];
  const CATEGORY_META = {
    "Food & dining": { icon: "☕", bg: "#fff7ed", color: "#ea580c" },
    Groceries: { icon: "🛒", bg: "#ecfdf5", color: "#059669" },
    Shopping: { icon: "◈", bg: "#f5f3ff", color: "#7c3aed" },
    Travel: { icon: "↗", bg: "#eff6ff", color: "#2563eb" },
    Education: { icon: "▤", bg: "#fefce8", color: "#ca8a04" },
    Entertainment: { icon: "♫", bg: "#fdf2f8", color: "#db2777" },
    "Bills & utilities": { icon: "ϟ", bg: "#f1f5f9", color: "#475569" },
    "Personal care": { icon: "✦", bg: "#fdf2f8", color: "#be185d" },
    Health: { icon: "+", bg: "#fef2f2", color: "#dc2626" },
    Other: { icon: "•", bg: "#f1f5f9", color: "#64748b" },
  };
  let state = {
    user: null,
    transactions: [],
    budgets: [],
    goals: [],
    currency: "INR",
  };
  let charts = {};
  let authMode = "login";
  let toastTimeout;
  const today = new Date();
  const isoDate = (d) => {
    const x = new Date(d);
    x.setMinutes(x.getMinutes() - x.getTimezoneOffset());
    return x.toISOString().slice(0, 10);
  };
  const uid = () =>
    "id-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const money = (n) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: state.currency,
      maximumFractionDigits: 0,
    }).format(Number(n) || 0);
  const escapeHTML = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  function toast(message) {
    const el = $("#toast");
    el.textContent = message;
    el.classList.add("show");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => el.classList.remove("show"), 2600);
  }
  function load() {
    try {
      const d = JSON.parse(localStorage.getItem(KEYS.data) || "null");
      if (d) state = { ...state, ...d };
    } catch (e) {
      console.warn("SpendWise data could not be read", e);
    }
  }
  function save() {
    localStorage.setItem(
      KEYS.data,
      JSON.stringify({
        user: state.user,
        transactions: state.transactions,
        budgets: state.budgets,
        goals: state.goals,
        currency: state.currency,
      }),
    );
  }
  function getUsers() {
    try {
      return JSON.parse(localStorage.getItem(KEYS.users) || "{}");
    } catch {
      return {};
    }
  }
  function saveUsers(users) {
    localStorage.setItem(KEYS.users, JSON.stringify(users));
  }
  function monthStart(d = new Date()) {
    return new Date(d.getFullYear(), d.getMonth(), 1);
  }
  function sameMonth(date) {
    const d = new Date(date + "T12:00:00");
    return (
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth()
    );
  }
  function startOfWeek(d = new Date()) {
    const x = new Date(d);
    const day = (x.getDay() + 6) % 7;
    x.setDate(x.getDate() - day);
    x.setHours(0, 0, 0, 0);
    return x;
  }
  function periodTransactions(period, category) {
    let list = state.transactions;
    if (category && category !== "All categories")
      list = list.filter((t) => t.category === category);
    const now = new Date();
    if (period === "day") list = list.filter((t) => t.date === isoDate(now));
    if (period === "week")
      list = list.filter(
        (t) => new Date(t.date + "T12:00:00") >= startOfWeek(now),
      );
    if (period === "month") list = list.filter((t) => sameMonth(t.date));
    if (period === "year")
      list = list.filter(
        (t) =>
          new Date(t.date + "T12:00:00").getFullYear() === now.getFullYear(),
      );
    return list;
  }
  function sum(list) {
    return list.reduce((a, t) => a + Number(t.amount || 0), 0);
  }
  function getBudgetSpent(b) {
    return sum(periodTransactions(b.period, b.category));
  }
  function getMonthSpent() {
    return sum(state.transactions.filter((t) => sameMonth(t.date)));
  }
  function monthLabel(date) {
    return date.toLocaleDateString("en-US", { month: "short" });
  }
  function seedDemo() {
    if (!state.user || state.transactions.length || state.budgets.length)
      return;
    const offsets = [];
    const expenses = [];
    state.transactions = expenses.map((e, i) => {
      const d = new Date();
      d.setDate(d.getDate() - offsets[i]);
      return {
        id: uid(),
        description: e[0],
        amount: e[1],
        category: e[2],
        date: isoDate(d),
        method: i % 2 ? "UPI" : "Debit card",
        note: "",
      };
    });
    state.budgets = [
      {
        id: uid(),
        name: "Monthly essentials",
        period: "month",
        limit: 20000,
        category: "All categories",
        threshold: 80,
      },
      {
        id: uid(),
        name: "Food & dining",
        period: "month",
        limit: 5000,
        category: "Food & dining",
        threshold: 80,
      },
      {
        id: uid(),
        name: "Weekly spending",
        period: "week",
        limit: 4000,
        category: "All categories",
        threshold: 80,
      },
    ];
    state.goals = [
      {
        id: uid(),
        name: "New laptop",
        target: 60000,
        saved: 12000,
        deadline: "",
      },
    ];
    save();
  }
  function go(page) {
    const landing = $("#landingPage"),
      auth = $("#authPage"),
      app = $("#appPage");
    landing.classList.toggle("hidden", page !== "landing");
    auth.classList.toggle("hidden", page !== "auth");
    app.classList.toggle("hidden", page === "landing" || page === "auth");
    $$(".nav-link").forEach((b) =>
      b.classList.toggle("active", b.dataset.page === page),
    );
    $("#mainNav").classList.remove("open");
    if (
      page === "dashboard" ||
      page === "transactions" ||
      page === "budgets" ||
      page === "analytics" ||
      page === "reports"
    ) {
      if (!state.user) {
        showAuth("login");
        return;
      }
      showView(page);
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function showAuth(mode) {
    authMode = mode;
    $("#authTitle").textContent =
      mode === "signup" ? "Create your account" : "Welcome back";
    $("#authSubtitle").textContent =
      mode === "signup"
        ? "A clearer money routine starts with one small step."
        : "Log in to pick up where you left off.";
    $("#nameLabel").classList.toggle("hidden", mode !== "signup");
    $("#authName").required = mode === "signup";
    $("#authPassword").autocomplete =
      mode === "signup" ? "new-password" : "current-password";
    $("#authSubmit").textContent =
      mode === "signup" ? "Create account" : "Log in";
    $("#authSwitchText").textContent =
      mode === "signup" ? "Already have an account?" : "New to SpendWise?";
    $("#authSwitch").textContent =
      mode === "signup" ? "Log in" : "Create an account";
    $("#authError").textContent = "";
    go("auth");
  }
  const pageInfo = {
    dashboard: ["Dashboard", "A little clarity for your everyday decisions."],
    transactions: [
      "Transactions",
      "Every purchase tells a story. Keep it organized.",
    ],
    budgets: ["Budgets & alerts", "Set limits that support your goals."],
    analytics: ["Analytics & goals", "Spot patterns and plan what comes next."],
    reports: ["Reports & settings", "Your data, your preferences, your pace."],
  };
  function showView(page) {
    const valid = pageInfo[page] ? page : "dashboard";
    $$(".view").forEach((v) => v.classList.add("hidden"));
    $("#" + valid + "View").classList.remove("hidden");
    $("#pageTitle").textContent = pageInfo[valid][0];
    $("#pageSubtitle").textContent = pageInfo[valid][1];
    $("#todayLabel").textContent = today.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    renderAll();
    if (valid === "reports") fillSettings();
  }
  function chartDestroy(key) {
    if (charts[key]) {
      charts[key].destroy();
      delete charts[key];
    }
  }
  function renderCharts() {
    if (!window.Chart) return;
    const blue = "#3b82f6",
      colors = [
        "#3b82f6",
        "#8b5cf6",
        "#10b981",
        "#f59e0b",
        "#ec4899",
        "#06b6d4",
        "#64748b",
        "#f97316",
        "#ef4444",
        "#a3a3a3",
      ];
    Chart.defaults.font.family = '"DM Sans", sans-serif';
    Chart.defaults.color = "#8490a4";
    const count = Number($("#overviewRange")?.value || 6),
      labels = [],
      values = [];
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      labels.push(monthLabel(d));
      values.push(
        sum(
          state.transactions.filter((t) => {
            const td = new Date(t.date + "T12:00:00");
            return (
              td.getFullYear() === d.getFullYear() &&
              td.getMonth() === d.getMonth()
            );
          }),
        ),
      );
    }
    chartDestroy("trend");
    const ctx = $("#trendChart");
    if (ctx)
      charts.trend = new Chart(ctx, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Expenses",
              data: values,
              borderColor: blue,
              backgroundColor: "rgba(59,130,246,.12)",
              fill: true,
              tension: 0.38,
              pointRadius: 3,
              pointHoverRadius: 5,
              pointBackgroundColor: "#fff",
              pointBorderWidth: 2,
              borderWidth: 2.5,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (c) => money(c.raw) } },
          },
          scales: {
            y: {
              beginAtZero: true,
              grid: { color: "#eef2f8" },
              ticks: { callback: (v) => money(v) },
            },
            x: { grid: { display: false } },
          },
        },
      });
    const cats = {};
    state.transactions
      .filter((t) => sameMonth(t.date))
      .forEach(
        (t) => (cats[t.category] = (cats[t.category] || 0) + Number(t.amount)),
      );
    const entries = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    const labelsC = entries.length ? entries.map((e) => e[0]) : ["No expenses"];
    const dataC = entries.length ? entries.map((e) => e[1]) : [1];
    const colorC = entries.length
      ? entries.map((e) => CATEGORY_META[e[0]]?.color || blue)
      : ["#e8edf5"];
    ["categoryChart", "analyticsCategoryChart"].forEach((id, i) => {
      chartDestroy(id);
      const canvas = $("#" + id);
      if (canvas)
        charts[id] = new Chart(canvas, {
          type: "doughnut",
          data: {
            labels: labelsC,
            datasets: [
              {
                data: dataC,
                backgroundColor: colorC,
                borderWidth: 3,
                borderColor: "#fff",
                hoverOffset: 5,
              },
            ],
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: "69%",
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label: (c) =>
                    `${c.label}: ${money(entries[c.dataIndex]?.[1] || 0)}`,
                },
              },
            },
          },
        });
    });
    const legend = $("#categoryLegend");
    if (legend)
      legend.innerHTML = entries.length
        ? entries
            .slice(0, 6)
            .map(
              ([name, val]) =>
                `<div class="legend-item"><span class="legend-dot" style="background:${CATEGORY_META[name]?.color || blue}"></span><span>${escapeHTML(name)}</span><strong class="legend-value">${money(val)}</strong></div>`,
            )
            .join("")
        : '<div class="muted small">Add an expense to see your categories.</div>';
  }
  function renderDashboard() {
    const spent = getMonthSpent(),
      monthBudget =
        sum(
          state.budgets
            .filter(
              (b) => b.period === "month" && b.category === "All categories",
            )
            .map((b) => b.limit),
        ) || 20000;
    const days = Math.max(1, today.getDate()),
      daysInMonth = new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0,
      ).getDate();
    $("#totalSpent").textContent = money(spent);
    $("#budgetLeft").textContent = money(monthBudget - spent);
    $("#budgetLeftText").textContent =
      spent > monthBudget
        ? "You've passed this budget limit"
        : `${Math.max(0, Math.round(((monthBudget - spent) / monthBudget) * 100))}% of budget remains`;
    $("#dailyAverage").textContent = money(spent / days);
    $("#forecast").textContent = money((spent / days) * daysInMonth);
    $("#spentTrendText").textContent = state.transactions.length
      ? `${state.transactions.filter((t) => sameMonth(t.date)).length} expenses this month`
      : "Add your first expense";
    $("#spentTrend").className =
      "trend " + (spent <= monthBudget ? "good" : "neutral");
    const pulse = $("#budgetPulse");
    pulse.innerHTML =
      state.budgets
        .slice(0, 4)
        .map((b) => {
          const value = getBudgetSpent(b),
            pct = Math.min(100, Math.round((value / b.limit) * 100));
          return `<div class="pulse-row"><div class="pulse-top"><strong>${escapeHTML(b.name)}</strong><span>${money(value)} / ${money(b.limit)}</span></div><div class="progress"><span class="${pct >= 100 ? "over" : pct >= b.threshold ? "warning" : ""}" style="width:${pct}%"></span></div></div>`;
        })
        .join("") ||
      '<p class="muted">Create a budget to see your progress here.</p>';
    const recent = [...state.transactions]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 5);
    $("#recentList").innerHTML =
      recent.map(txItem).join("") ||
      '<p class="empty-state">Your recent expenses will appear here.</p>';
    renderCharts();
  }
  function txItem(t) {
    const m = CATEGORY_META[t.category] || CATEGORY_META.Other;
    return `<div class="transaction-item"><span class="tx-icon" style="background:${m.bg};color:${m.color}">${m.icon}</span><div class="tx-main"><strong>${escapeHTML(t.description)}</strong><small>${escapeHTML(t.category)} · ${new Date(t.date + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</small></div><strong class="tx-amount">${money(t.amount)}</strong></div>`;
  }
  function fillCategorySelects() {
    const options = CATEGORIES.map(
      (c) => `<option value="${escapeHTML(c)}">${escapeHTML(c)}</option>`,
    ).join("");
    $("#expenseCategory").innerHTML = options;
    $("#budgetCategory").innerHTML =
      "<option>All categories</option>" + options;
    $("#categoryFilter").innerHTML =
      '<option value="">All categories</option>' + options;
  }
  function renderTransactions() {
    const q = $("#transactionSearch").value.trim().toLowerCase(),
      cat = $("#categoryFilter").value,
      period = $("#periodFilter").value;
    let list = [...state.transactions].sort((a, b) =>
      b.date.localeCompare(a.date),
    );
    if (q)
      list = list.filter((t) =>
        (t.description + " " + t.category + " " + (t.note || ""))
          .toLowerCase()
          .includes(q),
      );
    if (cat) list = list.filter((t) => t.category === cat);
    if (period === "month") list = list.filter((t) => sameMonth(t.date));
    if (period === "week")
      list = list.filter(
        (t) => new Date(t.date + "T12:00:00") >= startOfWeek(),
      );
    $("#transactionRows").innerHTML = list
      .map(
        (t) =>
          `<tr><td>${escapeHTML(t.description)}</td><td>${escapeHTML(t.category)}</td><td>${new Date(t.date + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</td><td>${escapeHTML(t.method || "—")}</td><td class="align-right">${money(t.amount)}</td><td><div class="table-actions"><button class="icon-action" data-edit="${t.id}" aria-label="Edit ${escapeHTML(t.description)}">Edit</button><button class="icon-action" data-delete="${t.id}" aria-label="Delete ${escapeHTML(t.description)}">×</button></div></td></tr>`,
      )
      .join("");
    $("#emptyTransactions").classList.toggle("hidden", list.length > 0);
  }
  function renderBudgets() {
    const el = $("#budgetCards");
    el.innerHTML =
      state.budgets
        .map((b) => {
          const spent = getBudgetSpent(b),
            pct = Math.round((spent / b.limit) * 100);
          return `<article class="budget-card"><div class="budget-card-head"><strong>${escapeHTML(b.name)}</strong><span class="budget-badge">${b.period.toUpperCase()}</span></div><div class="budget-amount">${money(spent)}</div><div class="budget-sub">of ${money(b.limit)} ${b.category !== "All categories" ? "· " + escapeHTML(b.category) : ""}</div><div class="progress"><span class="${pct >= 100 ? "over" : pct >= (b.threshold || 80) ? "warning" : ""}" style="width:${Math.min(100, pct)}%"></span></div><div class="budget-card-foot"><span>${pct}% used · ${money(b.limit - spent)} left</span><button data-delete-budget="${b.id}">Remove</button></div></article>`;
        })
        .join("") ||
      '<div class="panel"><p class="muted">No budgets yet. Set a limit to make a plan.</p></div>';
    const alerts = state.budgets
      .map((b) => {
        const pct = Math.round((getBudgetSpent(b) / b.limit) * 100);
        return { b, pct };
      })
      .filter((x) => x.pct >= x.b.threshold || x.pct >= 100);
    $("#alertsList").innerHTML = alerts.length
      ? alerts
          .map(
            ({ b, pct }) =>
              `<div class="alert-row"><span class="alert-symbol ${pct < 100 ? "" : " "}">${pct >= 100 ? "!" : "↗"}</span><div><strong>${pct >= 100 ? "Budget limit reached: " : "You're getting close: "}${escapeHTML(b.name)}</strong><small>You've used ${pct}% of your ${b.period} limit (${money(getBudgetSpent(b))} of ${money(b.limit)}).</small></div></div>`,
          )
          .join("")
      : `<div class="alert-row"><span class="alert-symbol ok">✓</span><div><strong>You're in a good place.</strong><small>No budget alerts right now. Keep checking in with your spending.</small></div></div>`;
  }
  function renderAnalytics() {
    const spent = getMonthSpent(),
      days = Math.max(1, today.getDate()),
      daysInMonth = new Date(
        today.getFullYear(),
        today.getMonth() + 1,
        0,
      ).getDate(),
      forecast = (spent / days) * daysInMonth;
    $("#analyticsForecast").textContent = money(forecast);
    $("#forecastMessage").textContent = spent
      ? `At your current pace, you may spend around ${money(forecast)} this month.`
      : "Add a few expenses and SpendWise will estimate your month-end total.";
    const entries = Object.entries(
      state.transactions
        .filter((t) => sameMonth(t.date))
        .reduce(
          (o, t) => (
            (o[t.category] = (o[t.category] || 0) + Number(t.amount)),
            o
          ),
          {},
        ),
    ).sort((a, b) => b[1] - a[1]);
    const notes = [];
    if (entries.length)
      notes.push(
        `Your largest category so far is ${entries[0][0]} at ${money(entries[0][1])}.`,
      );
    notes.push(
      `Your daily average is ${money(spent / days)} across ${days} ${days === 1 ? "day" : "days"} of this month.`,
    );
    notes.push(
      state.budgets.length
        ? `You have ${state.budgets.length} active budget${state.budgets.length === 1 ? "" : "s"} to help guide your spending.`
        : "Create a budget to give your spending a helpful guardrail.",
    );
    $("#insightNotes").innerHTML = notes
      .map(
        (n) =>
          `<div class="insight-note"><span>✦</span><div>${escapeHTML(n)}</div></div>`,
      )
      .join("");
    $("#goalCards").innerHTML =
      state.goals
        .map((g) => {
          const pct = Math.min(100, Math.round((g.saved / g.target) * 100));
          return `<article class="goal-card"><div class="goal-card-top"><span class="goal-emoji">✦</span><div><h3>${escapeHTML(g.name)}</h3><small>${g.deadline ? "Target " + new Date(g.deadline + "T12:00:00").toLocaleDateString("en-IN", { month: "short", year: "numeric" }) : "Your next milestone"}</small></div></div><div class="goal-numbers"><span>Saved <strong>${money(g.saved)}</strong></span><span>Goal <strong>${money(g.target)}</strong></span></div><div class="progress"><span style="width:${pct}%"></span></div><div class="goal-progress"><span>${pct}% complete</span><button data-add-savings="${g.id}">＋ Add savings</button><button data-delete-goal="${g.id}">Remove</button></div></article>`;
        })
        .join("") ||
      '<p class="muted">No savings goals yet. Add one to give your money a destination.</p>';
  }
  function fillSettings() {
    $("#profileName").value = state.user?.name || "";
    $("#currencySetting").value = state.currency;
    $("#signedInAs").textContent = state.user
      ? `Signed in as ${state.user.email}`
      : "Demo account";
  }
  function renderAll() {
    renderDashboard();
    renderTransactions();
    renderBudgets();
    renderAnalytics();
    fillSettings();
  }
  function openTransaction(tx) {
    $("#transactionForm").reset();
    $("#transactionError").textContent = "";
    $("#transactionId").value = tx?.id || "";
    $("#transactionModalTitle").textContent = tx
      ? "Edit transaction"
      : "Add transaction";
    $("#expenseDescription").value = tx?.description || "";
    $("#expenseAmount").value = tx?.amount || "";
    $("#expenseDate").value = tx?.date || isoDate(new Date());
    $("#expenseCategory").value = tx?.category || CATEGORIES[0];
    $("#expenseMethod").value = tx?.method || "UPI";
    $("#expenseNote").value = tx?.note || "";
    $("#transactionDialog").showModal();
  }
  function downloadBlob(content, name, type) {
    const blob = new Blob([content], { type }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function csvEscape(value) {
    return '"' + String(value ?? "").replace(/"/g, '""') + '"';
  }
  function exportCsv() {
    const rows = [
      ["Date", "Description", "Category", "Payment method", "Amount", "Note"],
      ...state.transactions.map((t) => [
        t.date,
        t.description,
        t.category,
        t.method,
        t.amount,
        t.note,
      ]),
    ];
    downloadBlob(
      rows.map((r) => r.map(csvEscape).join(",")).join("\r\n"),
      "spendwise-transactions.csv",
      "text/csv;charset=utf-8",
    );
    toast("CSV report exported.");
  }
  function exportJson() {
    downloadBlob(
      JSON.stringify(
        {
          exportedAt: new Date().toISOString(),
          user: state.user,
          currency: state.currency,
          transactions: state.transactions,
          budgets: state.budgets,
          goals: state.goals,
        },
        null,
        2,
      ),
      "spendwise-backup.json",
      "application/json",
    );
    toast("Data backup exported.");
  }
  function init() {
    fillCategorySelects();
    $("#year").textContent = new Date().getFullYear();
    $("#todayLabel").textContent = today.toLocaleDateString("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
    });
    $("#expenseDate").value = isoDate(new Date());
    const email = localStorage.getItem(KEYS.session),
      users = getUsers();
    if (email && users[email]) {
      state.user = { name: users[email].name, email };
      load();
      state.user = { name: users[email].name, email };
      seedDemo();
      go("dashboard");
    } else {
      load();
      go("landing");
    }
    renderAll();
  }
  $$(".nav-link,[data-page]").forEach((el) =>
    el.addEventListener("click", () => {
      const p = el.dataset.page;
      if (p === "landing") go("landing");
      else go(p);
    }),
  );
  $("#navLogin").addEventListener("click", () => showAuth("login"));
  $("#navSignup").addEventListener("click", () => showAuth("signup"));
  $("#heroStart").addEventListener("click", () => showAuth("signup"));
  $("#ctaStart").addEventListener("click", () => showAuth("signup"));
  $("#authSwitch").addEventListener("click", () =>
    showAuth(authMode === "login" ? "signup" : "login"),
  );
  $("#mobileMenu").addEventListener("click", () =>
    $("#mainNav").classList.toggle("open"),
  );
  $$("[data-scroll]").forEach((b) =>
    b.addEventListener("click", () =>
      document
        .getElementById(b.dataset.scroll)
        ?.scrollIntoView({ behavior: "smooth" }),
    ),
  );
  $("#authForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const email = $("#authEmail").value.trim().toLowerCase(),
      password = $("#authPassword").value,
      users = getUsers();
    $("#authError").textContent = "";
    if (authMode === "signup") {
      const name = $("#authName").value.trim();
      if (!name) {
        $("#authError").textContent = "Please enter your name.";
        return;
      }
      if (users[email]) {
        $("#authError").textContent =
          "An account with this email already exists.";
        return;
      }
      users[email] = { name, password };
      saveUsers(users);
      state.user = { name, email };
      localStorage.setItem(KEYS.session, email);
      state.transactions = [];
      state.budgets = [];
      state.goals = [];
      save();
      seedDemo();
      go("dashboard");
      toast("Welcome to SpendWise!");
    } else {
      if (!users[email] || users[email].password !== password) {
        $("#authError").textContent =
          "Email or password doesn't match a demo account.";
        return;
      }
      state.user = { name: users[email].name, email };
      localStorage.setItem(KEYS.session, email);
      load();
      state.user = { name: users[email].name, email };
      seedDemo();
      go("dashboard");
      toast("You're logged in.");
    }
  });
  $("#quickAdd").addEventListener("click", () => openTransaction());
  $("#addTransaction").addEventListener("click", () => openTransaction());
  $("#transactionForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const amount = Number($("#expenseAmount").value);
    if (!(amount > 0)) {
      $("#transactionError").textContent = "Enter an amount greater than zero.";
      return;
    }
    const id = $("#transactionId").value,
      tx = {
        id: id || uid(),
        description: $("#expenseDescription").value.trim(),
        amount,
        category: $("#expenseCategory").value,
        date: $("#expenseDate").value,
        method: $("#expenseMethod").value,
        note: $("#expenseNote").value.trim(),
      };
    if (!tx.description || !tx.date) return;
    if (id)
      state.transactions = state.transactions.map((t) =>
        t.id === id ? tx : t,
      );
    else state.transactions.push(tx);
    save();
    $("#transactionDialog").close();
    renderAll();
    toast(id ? "Transaction updated." : "Expense added.");
  });
  $$("[data-close]").forEach((b) =>
    b.addEventListener("click", () => $("#" + b.dataset.close).close()),
  );
  $("#transactionSearch").addEventListener("input", renderTransactions);
  $("#categoryFilter").addEventListener("change", renderTransactions);
  $("#periodFilter").addEventListener("change", renderTransactions);
  $("#overviewRange").addEventListener("change", renderCharts);
  $("#transactionRows").addEventListener("click", (e) => {
    const edit = e.target.closest("[data-edit]"),
      del = e.target.closest("[data-delete]");
    if (edit) {
      const tx = state.transactions.find((t) => t.id === edit.dataset.edit);
      if (tx) openTransaction(tx);
    }
    if (del && confirm("Delete this transaction?")) {
      state.transactions = state.transactions.filter(
        (t) => t.id !== del.dataset.delete,
      );
      save();
      renderAll();
      toast("Transaction deleted.");
    }
  });
  $("#addBudget").addEventListener("click", () => {
    $("#budgetForm").reset();
    $("#budgetDialog").showModal();
  });
  $("#budgetForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const limit = Number($("#budgetLimit").value);
    if (!(limit > 0)) return;
    state.budgets.push({
      id: uid(),
      name: $("#budgetName").value.trim(),
      period: $("#budgetPeriod").value,
      limit,
      category: $("#budgetCategory").value,
      threshold: 80,
    });
    save();
    $("#budgetDialog").close();
    renderAll();
    toast("Budget saved.");
  });
  $("#budgetCards").addEventListener("click", (e) => {
    const b = e.target.closest("[data-delete-budget]");
    if (b) {
      state.budgets = state.budgets.filter(
        (x) => x.id !== b.dataset.deleteBudget,
      );
      save();
      renderAll();
      toast("Budget removed.");
    }
  });
  $("#addGoal").addEventListener("click", () => {
    $("#goalForm").reset();
    $("#goalDate").value = "";
    $("#goalDialog").showModal();
  });
  $("#goalForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const target = Number($("#goalTarget").value),
      saved = Number($("#goalSaved").value);
    if (!(target > 0) || saved < 0) return;
    state.goals.push({
      id: uid(),
      name: $("#goalName").value.trim(),
      target,
      saved,
      deadline: $("#goalDate").value,
    });
    save();
    $("#goalDialog").close();
    renderAll();
    toast("Savings goal created.");
  });
  $("#goalCards").addEventListener("click", (e) => {
    const add = e.target.closest("[data-add-savings]"),
      del = e.target.closest("[data-delete-goal]");
    if (add) {
      const goal = state.goals.find((g) => g.id === add.dataset.addSavings);
      if (!goal) return;
      const value = prompt("How much would you like to add to this goal?");
      if (value === null) return;
      const n = Number(value);
      if (!(n > 0)) {
        toast("Enter an amount greater than zero.");
        return;
      }
      goal.saved += n;
      save();
      renderAll();
      toast("Savings progress updated.");
    }
    if (del) {
      state.goals = state.goals.filter((g) => g.id !== del.dataset.deleteGoal);
      save();
      renderAll();
      toast("Goal removed.");
    }
  });
  $("#exportCsv").addEventListener("click", exportCsv);
  $("#exportJson").addEventListener("click", exportJson);
  $("#exportPdf").addEventListener("click", () => window.print());
  $("#settingsForm").addEventListener("submit", (e) => {
    e.preventDefault();
    state.user.name = $("#profileName").value.trim() || state.user.name;
    state.currency = $("#currencySetting").value;
    const users = getUsers();
    if (state.user.email && users[state.user.email]) {
      users[state.user.email].name = state.user.name;
      saveUsers(users);
    }
    save();
    renderAll();
    toast("Preferences saved.");
  });
  $("#signOut").addEventListener("click", () => {
    localStorage.removeItem(KEYS.session);
    state.user = null;
    go("landing");
    toast("Signed out.");
  });
  $("#clearData").addEventListener("click", () => {
    if (
      !confirm(
        "This removes transactions, budgets, goals, and local demo accounts from this browser. Continue?",
      )
    )
      return;
    localStorage.removeItem(KEYS.data);
    localStorage.removeItem(KEYS.users);
    localStorage.removeItem(KEYS.session);
    state = {
      user: null,
      transactions: [],
      budgets: [],
      goals: [],
      currency: "INR",
    };
    renderAll();
    go("landing");
    toast("Prototype data reset.");
  });
  window.addEventListener("beforeunload", save);
  init();
})();
