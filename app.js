const defaultCategories = [
  "Makanan & Minuman",
  "Transportasi",
  "Belanja",
  "Tagihan",
  "Hiburan",
  "Kesehatan",
  "Lainnya",
];
const defaultIncomeCategories = ["Pemasukan", "Bonus", "Freelance"];
let cats = [...defaultCategories];
const base = {
  income: 8000000,
  budget: 5000000,
  dailyBudget: 150000,
  transactions: [
    {
      id: "a",
      name: "Gaji bulanan",
      category: "Pemasukan",
      amount: 8000000,
      date: "2026-10-01",
      income: true,
    },
    {
      id: "b",
      name: "Belanja bulanan",
      category: "Belanja",
      amount: 850000,
      date: "2026-10-03",
    },
    {
      id: "c",
      name: "Transportasi",
      category: "Transportasi",
      amount: 320000,
      date: "2026-10-05",
    },
    {
      id: "d",
      name: "Kopi & makan siang",
      category: "Makanan & Minuman",
      amount: 185000,
      date: "2026-10-08",
    },
  ],
  goals: [{ id: "g1", name: "Dana darurat", target: 12000000, saved: 4500000 }],
  categoryBudgets: { "Makanan & Minuman": 1500000, Transportasi: 500000 },
  recurring: [],
  categories: [...defaultCategories],
};
let data = JSON.parse(localStorage.getItem("ruangDanaPro")) || structuredClone(base);
let supabaseClient = null;
let currentUser = null;
let authMode = "login";
let chartVisibility = { income: true, expense: true };
let chartPeriodMode = "month";
let chartCustomMonthValue = new Date().toISOString().slice(0, 7);
let selectedMonth = new Date().toISOString().slice(0, 7);
function normalizeData() {
  if (typeof data.dailyBudget !== "number") data.dailyBudget = 0;
  data.transactions ||= [];
  data.goals ||= [];
  data.recurring ||= [];
  const legacyCategories = [...(data.categories || defaultCategories), ...data.transactions.map((x) => x.category), ...defaultIncomeCategories];
  data.categories = legacyCategories.map((category) => typeof category === "string" ? { name: category, type: defaultIncomeCategories.includes(category) ? "income" : "expense", icon: category === "Pemasukan" ? "↓" : "•", color: "#1f9288" } : category)
    .filter((category, index, list) => category?.name && list.findIndex((item) => item.name.toLowerCase() === category.name.toLowerCase()) === index);
  data.transactions.forEach((transaction) => { if (transaction.note === undefined) transaction.note = ""; });
  data.monthSettings ||= {};
  cats = data.categories.filter((category) => category.type === "expense").map((category) => category.name);
}
const monthLabel = (month) => new Date(`${month}-01T00:00:00`).toLocaleDateString("id-ID", { month: "long", year: "numeric" });
const monthTransactions = (month = selectedMonth) => data.transactions.filter((transaction) => transaction.date?.slice(0, 7) === month);
const getMonthSettings = (month = selectedMonth) => data.monthSettings[month] || { income: data.income || 0, budget: data.budget || 0, dailyBudget: data.dailyBudget || 0, categoryBudgets: data.categoryBudgets || {} };
const daysInMonth = (month = selectedMonth) => new Date(+month.slice(0, 4), +month.slice(5, 7), 0).getDate();
const daysRemaining = (month = selectedMonth) => month === new Date().toISOString().slice(0, 7) ? Math.max(1, daysInMonth(month) - new Date().getDate() + 1) : daysInMonth(month);
normalizeData();
// Pendapatan dasar dari pengaturan bulanan tidak dihitung dua kali sebagai transaksi demo gaji.
if (typeof data.dailyBudget !== "number") data.dailyBudget = 0;
if (!data.transactions.some((x) => x.monthlyIncome)) {
  const monthlyTransaction = data.transactions.find((x) => x.name === "Gaji bulanan" && x.income);
  if (monthlyTransaction) monthlyTransaction.monthlyIncome = true;
}
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)],
  money = (n) => "Rp" + new Intl.NumberFormat("id-ID").format(n || 0),
  compactMoney = (n) => {
    if (!n) return "Rp0";
    if (n >= 1000000) {
      const val = (n / 1000000).toFixed(1).replace(".0", "").replace(".", ",");
      return `${val}jt`;
    }
    if (n >= 1000) {
      const val = (n / 1000).toFixed(0);
      return `${val}rb`;
    }
    return "Rp" + n;
  },
  number = (v) => Number(String(v).replace(/\D/g, "")) || 0,
  save = async () => {
    normalizeData();
    localStorage.setItem("ruangDanaPro", JSON.stringify(data));
    render();
    if (supabaseClient && currentUser) {
      const { error } = await supabaseClient.from("user_data").upsert({
        user_id: currentUser.id,
        data,
        updated_at: new Date().toISOString(),
      });
      if (error) { setSyncStatus("error", "Perubahan tersimpan lokal, tetapi gagal dikirim ke cloud."); toast("Data lokal tersimpan, tetapi sinkronisasi gagal."); }
      else setSyncStatus("synced", `Terakhir tersinkron ${new Date().toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`);
    }
  };
const icon = (name) => {
  return data.categories?.find((category) => category.name === name)?.icon || "•";
};
const categoryColor = (name) => data.categories?.find((category) => category.name === name)?.color || "#1f9288";
const date = (d) =>
  new Date(d + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
function exp() {
  return data.transactions.filter((x) => !x.income);
}
function inc() {
  return data.transactions.filter((x) => !!x.income);
}
const sum = (a) => a.reduce((s, x) => s + x.amount, 0);
function toast(t) {
  $("#toast").textContent = t;
  $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 3200);
}
function options(id, type = "expense") {
  const categories = data.categories.filter((category) => category.type === type).map((category) => category.name);
  $(id).innerHTML = categories.map((name) => `<option>${name}</option>`).join("");
}
function refreshCategoryInputs() {
  const expenseType = $("#expenseForm").type.value;
  options("#expenseCategory", expenseType);
  options("#budgetCategory", "expense");
  options("#recurringCategory", "expense");
  $("#filterCategory").innerHTML = '<option value="">Semua kategori</option>' + data.categories.map((category) => `<option>${category.name}</option>`).join("");
}
function render() {
  const settings = getMonthSettings(), transactions = monthTransactions(), expenses = transactions.filter((transaction) => !transaction.income), incomes = transactions.filter((transaction) => transaction.income), used = sum(expenses), totalIncome = settings.income + sum(incomes.filter((transaction) => !transaction.monthlyIncome)), saved = totalIncome - used, bp = settings.budget ? Math.min(100, (used / settings.budget) * 100) : 0, sp = totalIncome ? Math.max(0, Math.min(100, (saved / totalIncome) * 100)) : 0;
  const previousDate = new Date(`${selectedMonth}-01T00:00:00`);
  previousDate.setMonth(previousDate.getMonth() - 1);
  const previousMonthKey = previousDate.toISOString().slice(0, 7);
  const previousUsed = sum(monthTransactions(previousMonthKey).filter((transaction) => !transaction.income));
  const change = previousUsed ? Math.round(((used - previousUsed) / previousUsed) * 100) : 0;
  const todayKey = new Date().toISOString().slice(0, 10);
  const isCurrentMonth = selectedMonth === todayKey.slice(0, 7);
  const daysLeft = daysRemaining(selectedMonth);
  const remainingBudget = Math.max(0, settings.budget - used);
  const safePerDay = Math.floor(remainingBudget / daysLeft);
  const todayUsed = isCurrentMonth ? sum(expenses.filter((transaction) => transaction.date === todayKey)) : 0;
  const dailyPct = settings.dailyBudget ? Math.min(100, (todayUsed / settings.dailyBudget) * 100) : 0;

  $("#summaryTitle").textContent = `Ringkasan ${monthLabel(selectedMonth)}`;
  $("#balance").textContent = money(saved);
  if ($("#balancePeriod")) $("#balancePeriod").textContent = `Periode ${monthLabel(selectedMonth)} (pemasukan - pengeluaran)`;
  $("#incomeTotal").textContent = money(totalIncome);
  $("#expenseTotal").textContent = money(used);
  $("#savingsRate").textContent = `${Math.round(sp)}% tersisa`;

  // Safe daily spend card
  if ($("#safeDailySpend")) {
    $("#safeDailySpend").textContent = money(safePerDay);
    $("#safeDailySpendHint").textContent = !settings.budget
      ? "Belum ada anggaran bulanan"
      : isCurrentMonth
      ? `Sisa ${money(remainingBudget)} dibagi ${daysLeft} hari tersisa`
      : `Rata-rata aman untuk ${monthLabel(selectedMonth)}`;
    $("#daysRemainingBadge").textContent = `${daysLeft} hari lagi`;

    let safeStatusText = "✓ Pengeluaran hari ini masih aman";
    let safeState = "safe";
    if (!settings.budget) {
      safeStatusText = "Atur batas bulanan untuk melihat jatah aman";
      safeState = "safe";
    } else if (isCurrentMonth && todayUsed > safePerDay) {
      safeStatusText = `⚠️ Terpakai ${money(todayUsed)} (melewati jatah ${money(safePerDay)})`;
      safeState = "danger";
    } else if (isCurrentMonth && todayUsed > safePerDay * 0.75) {
      safeStatusText = `⚠️ Terpakai ${money(todayUsed)} (mendekati jatah ${money(safePerDay)})`;
      safeState = "warning";
    } else if (isCurrentMonth) {
      safeStatusText = `✓ Terpakai ${money(todayUsed)} dari jatah ${money(safePerDay)}`;
      safeState = "safe";
    } else {
      safeStatusText = `Bulan riwayat (${monthLabel(selectedMonth)})`;
      safeState = "safe";
    }
    $("#safeDailySpendStatus").textContent = safeStatusText;
    const safePct = safePerDay ? Math.min(100, Math.round((todayUsed / safePerDay) * 100)) : 0;
    $("#safeSpendBar").style.width = safePct + "%";
    $("#safeSpendBar").dataset.state = safeState;
  }

  // Monthly budget card
  $("#budgetLimit").textContent = money(settings.budget);
  $("#budgetRemaining").textContent = `Sisa ${money(remainingBudget)} yang bisa dipakai`;
  $("#savingTotal").textContent = money(saved);
  $("#budgetProgressText").textContent = settings.budget
    ? `${money(used)} terpakai · ${daysLeft} hari tersisa`
    : "Belum ada anggaran";
  $("#budgetPct").textContent = Math.round(bp) + "%";
  $("#savingPct").textContent = Math.round(sp) + "%";
  $("#budgetBar").style.width = bp + "%";
  $("#savingBar").style.width = sp + "%";

  // Daily budget card
  $("#dailyBudgetLimit").textContent = money(settings.dailyBudget);
  $("#dailyBudgetRemaining").textContent = `Sisa ${money(Math.max(0, settings.dailyBudget - todayUsed))} yang bisa dipakai`;
  $("#dailyProgressText").textContent = !isCurrentMonth
    ? "Batas harian hanya untuk bulan berjalan"
    : settings.dailyBudget
    ? `${money(todayUsed)} terpakai hari ini`
    : "Belum ada batas harian";
  $("#dailyPct").textContent = Math.round(dailyPct) + "%";
  $("#dailyBar").style.width = dailyPct + "%";

  // Budget states
  const budgetState = bp >= 100 ? "danger" : bp >= 75 ? "warning" : "safe";
  const dailyState = dailyPct >= 100 ? "danger" : dailyPct >= 75 ? "warning" : "safe";
  $("#budgetBar").dataset.state = budgetState;
  $("#dailyBar").dataset.state = dailyState;
  if ($("#budgetBarLarge")) {
    $("#budgetLarge").textContent = money(settings.budget);
    $("#budgetExplanation").textContent = settings.budget
      ? `${money(used)} terpakai. Sisa ${money(remainingBudget)}; rata-rata aman ${money(safePerDay)}/hari untuk ${daysLeft} hari.`
      : "Belum ada anggaran yang ditetapkan.";
    $("#budgetBarLarge").style.width = bp + "%";
    $("#budgetBarLarge").dataset.state = budgetState;
  }

  // Analytics chips & prioritized alerts
  const daysElapsed = isCurrentMonth ? Math.max(1, new Date().getDate()) : daysInMonth(selectedMonth);
  const avgDailyExpense = Math.round(used / daysElapsed);
  const maxExpense = expenses.length ? Math.max(...expenses.map((e) => e.amount)) : 0;
  const categoryTotals = {};
  expenses.forEach((x) => { categoryTotals[x.category] = (categoryTotals[x.category] || 0) + x.amount; });
  const topCatEntry = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0];
  const topCatName = topCatEntry ? topCatEntry[0] : "-";
  const topCatAmount = topCatEntry ? topCatEntry[1] : 0;

  if ($("#kpiChips")) {
    $("#kpiChips").innerHTML = `
      <span class="kpi-chip">🛍 Kategori terbesar: <b>${topCatName} (${money(topCatAmount)})</b></span>
      <span class="kpi-chip">📅 Rata-rata belanja: <b>${money(avgDailyExpense)}/hari</b></span>
      <span class="kpi-chip">⚡ Belanja tertinggi: <b>${money(maxExpense)}</b></span>
      <span class="kpi-chip">${previousUsed ? (change <= 0 ? `📉 Turun ${Math.abs(change)}% vs bln lalu` : `📈 Naik ${change}% vs bln lalu`) : "📊 Belum ada data bulan lalu"}</span>
    `;
  }

  const alerts = [];
  if (bp >= 100) {
    alerts.push({
      type: "danger",
      text: `🚨 Batas bulanan terlampaui ${money(used - settings.budget)} (${Math.round(bp)}%). Tahan pengeluaran yang tidak mendesak.`
    });
  } else if (bp >= 75) {
    alerts.push({
      type: "warning",
      text: `⚠️ Anggaran bulanan telah terpakai ${Math.round(bp)}% (tersisa ${money(remainingBudget)}). Prioritaskan kebutuhan pokok.`
    });
  } else if (settings.budget) {
    alerts.push({
      type: "safe",
      text: `✓ Anggaran bulanan aman: sisa ${money(remainingBudget)} (${Math.round(100 - bp)}% tersisa untuk ${daysLeft} hari).`
    });
  }

  if (isCurrentMonth && settings.dailyBudget && todayUsed > settings.dailyBudget) {
    alerts.push({
      type: "danger",
      text: `⚠️ Belanja hari ini (${money(todayUsed)}) melebihi batas harian (${money(settings.dailyBudget)}).`
    });
  } else if (isCurrentMonth && safePerDay && todayUsed > safePerDay) {
    alerts.push({
      type: "warning",
      text: `⚠️ Belanja hari ini (${money(todayUsed)}) melebihi jatah aman harian (${money(safePerDay)}).`
    });
  }

  const breachedCategory = Object.entries(settings.categoryBudgets || {}).find(([c, limit]) => {
    const cUsed = sum(expenses.filter((x) => x.category === c));
    return limit && cUsed >= limit;
  });
  if (breachedCategory && alerts.length < 3) {
    const cUsed = sum(expenses.filter((x) => x.category === breachedCategory[0]));
    alerts.push({
      type: "danger",
      text: `⚠️ Kategori "${breachedCategory[0]}" melebihi batas (${money(cUsed)} dari ${money(breachedCategory[1])}).`
    });
  }

  if (alerts.length < 2 && previousUsed) {
    alerts.push({
      type: change > 20 ? "warning" : "safe",
      text: change <= 0
        ? `📉 Pengeluaran bulan ini lebih hemat ${Math.abs(change)}% dibanding bulan lalu.`
        : `📈 Pengeluaran bulan ini naik ${change}% dibanding bulan lalu. Pantau sisa alokasi.`
    });
  }

  if ($("#dashboardAlerts")) {
    $("#dashboardAlerts").innerHTML = alerts
      .slice(0, 3)
      .map((a) => `<li class="alert-${a.type}">${a.text}</li>`)
      .join("");
  }

  $("#notificationDot").style.display = bp >= 75 || (isCurrentMonth && settings.dailyBudget && todayUsed > settings.dailyBudget) ? "block" : "none";
  renderCategories(expenses);
  renderTx();
  renderBudgets();
  renderGoals();
  renderChart();
  attachChartEvents();
}
function renderCategories(expenses = monthTransactions().filter((transaction) => !transaction.income)) {
  let o = {};
  expenses.forEach((x) => (o[x.category] = (o[x.category] || 0) + x.amount));
  let rows = Object.entries(o).sort((a, b) => b[1] - a[1]),
    max = rows[0]?.[1] || 1;
  $("#categoryList").innerHTML = rows.length
    ? rows
        .map(
          ([c, n]) =>
            `<div class="category-row"><span class="category-icon">${icon(c)}</span><div><b>${c}</b><small>${Math.round((n / sum(expenses)) * 100)}% dari total</small></div><strong>${money(n)}</strong><div class="mini-bar"><i style="width:${(n / max) * 100}%"></i></div></div>`,
        )
        .join("")
    : '<p class="subtitle">Belum ada pengeluaran.</p>';
}
function txHTML(x) {
  return `<div class="transaction-row"><span class="tx-icon" style="background:${categoryColor(x.category)}22">${icon(x.category)}</span><div><div class="tx-name">${x.name}</div><div class="tx-meta">${x.category} · ${date(x.date)}${x.note ? ` · ${x.note}` : ""}</div></div><strong class="tx-amount ${x.income ? "positive-amount" : "negative"}">${x.income ? "+" : "-"}${money(x.amount)}</strong><div class="tx-actions"><button data-edit="${x.id}" title="Ubah">✎</button><button data-duplicate="${x.id}" title="Duplikat">⧉</button><button data-delete="${x.id}" title="Hapus">×</button></div></div>`;
}
function renderTx() {
  let tx = [...monthTransactions()].sort((a, b) => b.date.localeCompare(a.date));
  const allTx = [...data.transactions].sort((a, b) => b.date.localeCompare(a.date));
  $("#recentTransactions").innerHTML =
    tx.slice(0, 4).map(txHTML).join("") ||
    '<p class="subtitle">Belum ada transaksi.</p>';
  let q = $("#searchTx").value.toLowerCase(),
    c = $("#filterCategory").value,
    type = $("#filterType").value,
    from = $("#filterFrom").value,
    to = $("#filterTo").value;
  $("#allTransactions").innerHTML =
    allTx
      .filter(
        (x) =>
          x.name.toLowerCase().includes(q) &&
          (!c || x.category === c) &&
          (!type || (type === "income") === !!x.income) &&
          (!$("#transactionMonth").value || x.date.slice(0, 7) === $("#transactionMonth").value) &&
          (!from || x.date >= from) &&
          (!to || x.date <= to),
      )
      .map(txHTML)
      .join("") || '<p class="subtitle">Tidak ada transaksi yang cocok.</p>';
}
function renderBudgets() {
  const settings = getMonthSettings();
  $("#categoryBudgets").innerHTML =
    Object.entries(settings.categoryBudgets || {})
      .map(([c, l]) => {
        let used = sum(monthTransactions().filter((x) => !x.income && x.category === c)),
          p = Math.min(100, (used / l) * 100);
        return `<article class="budget-item"><div><span>${icon(c)}</span><b>${c}</b><button data-remove-budget="${c}">×</button></div><strong>${money(used)} <small>/ ${money(l)}</small></strong><div class="progress-track"><i style="width:${p}%"></i></div><p>${Math.round(p)}% digunakan</p></article>`;
      })
      .join("") ||
    '<p class="subtitle">Tambahkan batas per kategori untuk mulai mengontrol belanja.</p>';
}
function renderGoals() {
  $("#goalList").innerHTML =
    data.goals
      .map((g) => {
        let p = Math.min(100, (g.saved / g.target) * 100), targetDate = g.deadline ? new Date(`${g.deadline}T00:00:00`) : null, monthsLeft = targetDate ? Math.max(1, (targetDate.getFullYear() - new Date().getFullYear()) * 12 + targetDate.getMonth() - new Date().getMonth()) : 0, monthly = Math.ceil(Math.max(0, g.target - g.saved) / (monthsLeft || 1));
        return `<article class="goal-card"><button data-delete-goal="${g.id}">×</button><span class="goal-icon">◎</span><h3>${g.name}</h3><strong>${money(g.saved)}</strong><small>dari ${money(g.target)}</small><div class="progress-track purple-track"><i style="width:${p}%"></i></div><p>${Math.round(p)}% tercapai</p>${g.deadline ? `<small>Target ${date(g.deadline)} · Sisihkan ${money(monthly)}/bulan</small>` : ""}<button class="outline-button goal-deposit" data-deposit-goal="${g.id}">＋ Setor</button></article>`;
      })
      .join("") ||
    '<div class="empty-state">Belum ada target. Mulai dengan satu tujuan kecil hari ini.</div>';
}
let currentChartDailyData = [];
function getChartDates() {
  const dates = [];
  if (chartPeriodMode === "7d") {
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      dates.push(d.toISOString().slice(0, 10));
    }
  } else {
    let targetMonth = selectedMonth;
    if (chartPeriodMode === "prevMonth") {
      const d = new Date(`${selectedMonth}-01T00:00:00`);
      d.setMonth(d.getMonth() - 1);
      targetMonth = d.toISOString().slice(0, 7);
    } else if (chartPeriodMode === "customMonth") {
      targetMonth = chartCustomMonthValue || selectedMonth;
    }
    const days = daysInMonth(targetMonth);
    for (let day = 1; day <= days; day++) {
      dates.push(`${targetMonth}-${String(day).padStart(2, "0")}`);
    }
  }
  return dates;
}
function renderChart() {
  if (!$("#cashflowSvg")) return;
  const dates = getChartDates();
  currentChartDailyData = dates.map((d) => {
    const dayTx = data.transactions.filter((x) => x.date === d);
    const inc = sum(dayTx.filter((x) => x.income));
    const exp = sum(dayTx.filter((x) => !x.income));
    return {
      date: d,
      income: inc,
      expense: exp,
      net: inc - exp,
    };
  });

  const dailyData = currentChartDailyData;
  const n = dailyData.length;
  if (!n) return;

  const rawMax = Math.max(100000, ...dailyData.map((d) => Math.max(d.income, d.expense)));
  const step = Math.ceil(rawMax / 4 / 50000) * 50000;
  const maxVal = Math.max(100000, step * 4);

  const padLeft = 60, padRight = 20, padTop = 20, padBottom = 32;
  const chartW = 640 - padLeft - padRight;
  const chartH = 230 - padTop - padBottom;

  const getX = (i) => padLeft + (i / Math.max(1, n - 1)) * chartW;
  const getY = (val) => padTop + chartH - (val / maxVal) * chartH;

  let gridSvg = "";
  for (let s = 0; s <= 4; s++) {
    const val = (s / 4) * maxVal;
    const y = getY(val);
    gridSvg += `
      <line x1="${padLeft}" y1="${y}" x2="${padLeft + chartW}" y2="${y}" stroke="currentColor" stroke-opacity="0.12" stroke-dasharray="3 3"/>
      <text x="${padLeft - 8}" y="${y + 3.5}" text-anchor="end" font-size="10" fill="#788c89">${compactMoney(val)}</text>
    `;
  }

  let xLabelsSvg = "";
  const labelStep = n <= 8 ? 1 : n <= 16 ? 2 : Math.ceil(n / 6);
  for (let i = 0; i < n; i++) {
    if (i === 0 || i === n - 1 || i % labelStep === 0) {
      const x = getX(i);
      const dObj = new Date(dailyData[i].date + "T00:00:00");
      const labelText = chartPeriodMode === "7d"
        ? dObj.toLocaleDateString("id-ID", { day: "numeric", month: "short" })
        : String(dObj.getDate()).padStart(2, "0");
      xLabelsSvg += `<text x="${x}" y="${padTop + chartH + 18}" text-anchor="middle" font-size="10" fill="#788c89">${labelText}</text>`;
    }
  }

  let pathsSvg = "";
  if (chartVisibility.income) {
    const incPoints = dailyData.map((d, i) => `${getX(i)},${getY(d.income)}`).join(" ");
    const incArea = `M ${getX(0)},${padTop + chartH} L ${incPoints} L ${getX(n - 1)},${padTop + chartH} Z`;
    pathsSvg += `
      <path d="${incArea}" fill="url(#incomeGrad)"/>
      <polyline points="${incPoints}" fill="none" stroke="#1f9288" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    `;
  }

  if (chartVisibility.expense) {
    const expPoints = dailyData.map((d, i) => `${getX(i)},${getY(d.expense)}`).join(" ");
    const expArea = `M ${getX(0)},${padTop + chartH} L ${expPoints} L ${getX(n - 1)},${padTop + chartH} Z`;
    pathsSvg += `
      <path d="${expArea}" fill="url(#expenseGrad)"/>
      <polyline points="${expPoints}" fill="none" stroke="#df7055" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
    `;
  }

  $("#cashflowSvg").innerHTML = `
    <defs>
      <linearGradient id="incomeGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1f9288" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#1f9288" stop-opacity="0.0"/>
      </linearGradient>
      <linearGradient id="expenseGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#df7055" stop-opacity="0.22"/>
        <stop offset="100%" stop-color="#df7055" stop-opacity="0.0"/>
      </linearGradient>
    </defs>
    ${gridSvg}
    ${xLabelsSvg}
    ${pathsSvg}
    <g id="chartInteractiveGroup"></g>
  `;

  const totalInc = sum(dailyData.map((d) => d.income));
  const totalExp = sum(dailyData.map((d) => d.expense));
  const netCash = totalInc - totalExp;
  const maxIncItem = dailyData.reduce((prev, curr) => (curr.income > prev.income ? curr : prev), { income: 0, date: "" });
  const maxExpItem = dailyData.reduce((prev, curr) => (curr.expense > prev.expense ? curr : prev), { expense: 0, date: "" });
  const avgExp = Math.round(totalExp / dailyData.length);

  if ($("#chartSummaryCards")) {
    $("#chartSummaryCards").innerHTML = `
      <div class="chart-kpi-item">
        <small>PEMASUKAN TERTINGGI</small>
        <strong style="color:#1f9288">${money(maxIncItem.income)}</strong>
        <small>${maxIncItem.income ? date(maxIncItem.date) : "Tidak ada transaksi"}</small>
      </div>
      <div class="chart-kpi-item">
        <small>PENGELUARAN TERTINGGI</small>
        <strong style="color:#df7055">${money(maxExpItem.expense)}</strong>
        <small>${maxExpItem.expense ? date(maxExpItem.date) : "Tidak ada transaksi"}</small>
      </div>
      <div class="chart-kpi-item">
        <small>RATA-RATA HARIAN</small>
        <strong>${money(avgExp)}/hari</strong>
        <small>Total belanja ${money(totalExp)}</small>
      </div>
      <div class="chart-kpi-item">
        <small>ARUS KAS BERSIH</small>
        <strong style="color:${netCash > 0 ? '#1f9288' : netCash < 0 ? '#df7055' : 'inherit'}">${netCash > 0 ? '+' : ''}${money(netCash)}</strong>
        <small>${netCash > 0 ? 'Surplus keuangan' : netCash < 0 ? 'Defisit keuangan' : 'Seimbang'}</small>
      </div>
    `;
  }

  if ($("#chartDataTable tbody")) {
    $("#chartDataTable tbody").innerHTML = dailyData
      .map(
        (d) => `
          <tr>
            <td><b>${date(d.date)}</b></td>
            <td style="color:#1f9288">${d.income ? '+' + money(d.income) : 'Rp0'}</td>
            <td style="color:#df7055">${d.expense ? '-' + money(d.expense) : 'Rp0'}</td>
            <td style="font-weight:700; color:${d.net >= 0 ? '#1f9288' : '#df7055'}">${d.net >= 0 ? '+' : ''}${money(d.net)}</td>
          </tr>
        `
      )
      .join("");
  }
}
function attachChartEvents() {
  const svg = $("#cashflowSvg");
  const tooltip = $("#chartTooltip");
  if (!svg || !tooltip || svg.dataset.eventsAttached) return;
  svg.dataset.eventsAttached = "true";

  const padLeft = 60, padRight = 20, padTop = 20, padBottom = 32;
  const chartW = 640 - padLeft - padRight;
  const chartH = 230 - padTop - padBottom;

  const handlePointer = (e) => {
    if (!currentChartDailyData.length) return;
    const rect = svg.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const relativeX = clientX - rect.left;
    const svgX = (relativeX / rect.width) * 640;

    const n = currentChartDailyData.length;
    const fraction = Math.max(0, Math.min(1, (svgX - padLeft) / chartW));
    const index = Math.round(fraction * (n - 1));
    const item = currentChartDailyData[index];
    if (!item) return;

    const rawMax = Math.max(100000, ...currentChartDailyData.map((d) => Math.max(d.income, d.expense)));
    const step = Math.ceil(rawMax / 4 / 50000) * 50000;
    const maxVal = Math.max(100000, step * 4);

    const getX = (i) => padLeft + (i / Math.max(1, n - 1)) * chartW;
    const getY = (val) => padTop + chartH - (val / maxVal) * chartH;
    const x = getX(index);
    const yInc = getY(item.income);
    const yExp = getY(item.expense);

    const group = $("#chartInteractiveGroup");
    if (group) {
      let circles = "";
      if (chartVisibility.income) {
        circles += `<circle cx="${x}" cy="${yInc}" r="5" fill="#fff" stroke="#1f9288" stroke-width="2.5"/>`;
      }
      if (chartVisibility.expense) {
        circles += `<circle cx="${x}" cy="${yExp}" r="5" fill="#fff" stroke="#df7055" stroke-width="2.5"/>`;
      }
      group.innerHTML = `
        <line x1="${x}" y1="${padTop}" x2="${x}" y2="${padTop + chartH}" stroke="#8cb5ae" stroke-width="1.5" stroke-dasharray="3 3"/>
        ${circles}
      `;
    }

    const tooltipLeft = Math.max(85, Math.min(rect.width - 85, (x / 640) * rect.width));
    const minY = Math.min(yInc, yExp);
    const tooltipTop = Math.max(15, (minY / 230) * rect.height);

    tooltip.style.left = `${tooltipLeft}px`;
    tooltip.style.top = `${tooltipTop}px`;
    tooltip.innerHTML = `
      <div class="chart-tooltip-date">${new Date(item.date + "T00:00:00").toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</div>
      <div class="chart-tooltip-row"><span>Pemasukan:</span><b style="color:#2ec4b6">+${money(item.income)}</b></div>
      <div class="chart-tooltip-row"><span>Pengeluaran:</span><b style="color:#ff8566">-${money(item.expense)}</b></div>
      <div class="chart-tooltip-net"><span>Arus bersih:</span><b style="color:${item.net > 0 ? '#48cfb2' : item.net < 0 ? '#ff8566' : '#fff'}">${item.net > 0 ? '+' : ''}${money(item.net)}</b></div>
    `;
    tooltip.classList.add("show");
    tooltip.setAttribute("aria-hidden", "false");
  };

  const hidePointer = () => {
    const group = $("#chartInteractiveGroup");
    if (group) group.innerHTML = "";
    tooltip.classList.remove("show");
    tooltip.setAttribute("aria-hidden", "true");
  };

  svg.addEventListener("mousemove", handlePointer);
  svg.addEventListener("mouseleave", hidePointer);
  svg.addEventListener("touchstart", (e) => { handlePointer(e); }, { passive: true });
  svg.addEventListener("touchmove", (e) => { handlePointer(e); }, { passive: true });
  document.addEventListener("touchstart", (e) => {
    if (!svg.contains(e.target) && !tooltip.contains(e.target)) hidePointer();
  });
}
function modal(id) {
  $("#" + id).classList.add("open");
}
function close(id) {
  $("#" + id).classList.remove("open");
}
function go(p) {
  $$(".page").forEach((x) => x.classList.remove("active-page"));
  $("#" + p).classList.add("active-page");
  $$(".nav-link").forEach((x) =>
    x.classList.toggle("active", x.dataset.page === p),
  );
  $("#pageTitle").textContent = {
    dashboard: "Selamat datang, Farhan 👋",
    transaksi: "Transaksi keuangan",
    anggaran: "Anggaran bulanan",
    target: "Target tabungan",
    pengaturan: "Pengaturan",
  }[p];
  $("[data-dashboard-only]").style.display = p === "dashboard" ? "inline-flex" : "none";
  history.replaceState(null, "", "#" + p);
}
function closeMobileMenu() {
  $("#sidebar").classList.remove("open");
  $("#sidebarBackdrop").classList.remove("open");
  $("#menuToggle").setAttribute("aria-label", "Buka menu navigasi");
  $("#menuToggle").textContent = "☰";
}
function toggleMobileMenu() {
  const open = $("#sidebar").classList.toggle("open");
  $("#sidebarBackdrop").classList.toggle("open", open);
  $("#menuToggle").setAttribute("aria-label", open ? "Tutup menu navigasi" : "Buka menu navigasi");
  $("#menuToggle").textContent = open ? "×" : "☰";
}
$("#menuToggle").onclick = toggleMobileMenu;
$("#sidebarBackdrop").onclick = closeMobileMenu;
$$(".nav-link").forEach(
  (x) =>
    (x.onclick = (e) => {
      e.preventDefault();
      go(x.dataset.page);
      closeMobileMenu();
    }),
);
$$("[data-go]").forEach((x) => (x.onclick = () => go(x.dataset.go)));
$("#openExpense").onclick = () => {
  let f = $("#expenseForm");
  f.reset();
  f.id.value = "";
  refreshCategoryInputs();
  f.type.value = "expense";
  refreshCategoryInputs();
  f.date.value = new Date().toISOString().slice(0, 10);
  $("#expenseTitle").textContent = "Catat transaksi";
  modal("expenseModal");
};
$("#openBudget").onclick = $("#openBudget2").onclick = () => {
  let f = $("#budgetForm"), settings = getMonthSettings();
  f.income.value = money(settings.income);
  f.budget.value = money(settings.budget);
  f.dailyBudget.value = settings.dailyBudget ? money(settings.dailyBudget) : "";
  modal("budgetModal");
};
$("#openGoal").onclick = () => modal("goalModal");
$("#addCategoryBudget").onclick = () => modal("categoryModal");
$("#addCategory").onclick = $("#addCategory2").onclick = () => openCategoryEditor();
$("#openRecurring").onclick = () => {
  renderRecurring();
  modal("recurringModal");
};
$$("[data-close]").forEach((x) => (x.onclick = () => close(x.dataset.close)));
$$(".currency-input").forEach((x) =>
  x.addEventListener("input", () => {
    let n = number(x.value);
    x.value = n ? money(n) : "";
  }),
);
$("#expenseForm").onsubmit = (e) => {
  e.preventDefault();
  let f = e.target,
    id = f.id.value,
    old = data.transactions.find((x) => x.id === id),
    x = {
      id: id || crypto.randomUUID(),
      name: f.name.value,
      category: f.category.value,
      amount: number(f.amount.value),
      date: f.date.value,
      income: f.type.value === "income",
    };
  x.note = f.note.value.trim();
  const receiptFile = f.receiptFile.files[0];
  if (receiptFile) {
    const reader = new FileReader();
    reader.onload = () => { x.receipt = reader.result; completeTransactionSave(x, old, id); };
    reader.readAsDataURL(receiptFile);
    return;
  }
  completeTransactionSave(x, old, id);
};
function completeTransactionSave(transaction, old, id) {
  if (old) Object.assign(old, transaction);
  else data.transactions.push(transaction);
  close("expenseModal");
  save();
  toast(id ? "Transaksi berhasil diperbarui" : "Transaksi berhasil disimpan");
}
$("#budgetForm").onsubmit = (e) => {
  e.preventDefault();
  data.monthSettings[selectedMonth] = { ...getMonthSettings(), income: number(e.target.income.value), budget: number(e.target.budget.value), dailyBudget: number(e.target.dailyBudget.value) };
  close("budgetModal");
  save();
  toast("Pengaturan bulanan disimpan");
};
$("#goalForm").onsubmit = (e) => {
  e.preventDefault();
  let f = e.target;
  data.goals.push({
    id: crypto.randomUUID(),
    name: f.name.value,
    target: number(f.target.value),
    saved: number(f.saved.value),
    deadline: f.deadline.value,
    deposits: [],
  });
  f.reset();
  close("goalModal");
  save();
  toast("Target tabungan dibuat");
};
$("#categoryForm").onsubmit = (e) => {
  e.preventDefault();
  const settings = getMonthSettings();
  settings.categoryBudgets ||= {};
  settings.categoryBudgets[e.target.category.value] = number(e.target.limit.value);
  data.monthSettings[selectedMonth] = settings;
  close("categoryModal");
  save();
  toast("Batas kategori disimpan");
};
$("#newCategoryForm").onsubmit = (e) => {
  e.preventDefault();
  const form = e.target, name = form.name.value.trim(), originalName = form.originalName.value;
  if (data.categories.some((category) => category.name.toLowerCase() === name.toLowerCase() && category.name !== originalName)) return toast("Kategori sudah ada");
  if (originalName) {
    const category = data.categories.find((item) => item.name === originalName);
    Object.assign(category, { name, type: form.type.value, icon: form.icon.value.trim() || "•", color: form.color.value });
    data.transactions.forEach((transaction) => { if (transaction.category === originalName) transaction.category = name; });
    Object.values(data.monthSettings).forEach((settings) => { if (settings.categoryBudgets?.[originalName] !== undefined) { settings.categoryBudgets[name] = settings.categoryBudgets[originalName]; delete settings.categoryBudgets[originalName]; } });
  } else data.categories.push({ name, type: form.type.value, icon: form.icon.value.trim() || "•", color: form.color.value });
  form.reset(); form.originalName.value = "";
  close("newCategoryModal");
  refreshCategoryInputs(); save(); renderCategoryManager();
  toast(originalName ? "Kategori berhasil diperbarui" : "Kategori berhasil ditambahkan");
};
function renderCategoryManager() {
  $("#categoryManager").innerHTML = data.categories.map((category) => `<div class="category-manage-row"><span class="category-icon" style="background:${category.color}22">${category.icon}</span><div><b>${category.name}</b><small>${category.type === "income" ? "Pemasukan" : "Pengeluaran"}</small></div><div><button class="text-button" data-edit-category="${category.name}">Ubah</button><button class="text-button danger-text" data-delete-category="${category.name}">Hapus</button></div></div>`).join("") || '<p class="subtitle">Belum ada kategori.</p>';
}
function openCategoryEditor(name = "") {
  const form = $("#newCategoryForm"), category = data.categories.find((item) => item.name === name);
  form.reset();
  $("#categoryMode").textContent = category ? "UBAH KATEGORI" : "KATEGORI BARU";
  $("#categoryTitle").textContent = category ? "Ubah kategori" : "Tambah kategori";
  if (category) { form.originalName.value = category.name; form.name.value = category.name; form.type.value = category.type; form.icon.value = category.icon; form.color.value = category.color; }
  modal("newCategoryModal");
}
$("#recurringForm").onsubmit = (e) => {
  e.preventDefault();
  let f = e.target;
  if (!f.name.value || !number(f.amount.value)) return;
  data.recurring.push({
    id: crypto.randomUUID(),
    name: f.name.value,
    category: f.category.value,
    amount: number(f.amount.value),
    day: f.day.value,
  });
  f.reset();
  save();
  renderRecurring();
  toast("Transaksi rutin ditambahkan");
};
document.body.onclick = (e) => {
  let id = e.target.dataset.editCategory;
  if (id) { openCategoryEditor(id); return; }
  if ((id = e.target.dataset.deleteCategory)) {
    const hasTransactions = data.transactions.some((transaction) => transaction.category === id);
    if (hasTransactions) return toast("Kategori masih dipakai transaksi. Ubah kategorinya dulu sebelum menghapus.");
    if (confirm(`Hapus kategori ${id}?`)) { data.categories = data.categories.filter((category) => category.name !== id); refreshCategoryInputs(); save(); renderCategoryManager(); }
    return;
  }
  if ((id = e.target.dataset.duplicate)) {
    const source = data.transactions.find((transaction) => transaction.id === id);
    if (source) { const copy = { ...source, id: crypto.randomUUID(), date: new Date().toISOString().slice(0, 10) }; data.transactions.push(copy); save(); toast("Transaksi berhasil diduplikat"); }
    return;
  }
  id = e.target.dataset.edit;
  if (id) {
    let x = data.transactions.find((y) => y.id === id),
      f = $("#expenseForm");
    f.id.value = x.id;
    f.name.value = x.name;
    f.type.value = x.income ? "income" : "expense";
    refreshCategoryInputs();
    f.category.value = x.category;
    f.amount.value = money(x.amount);
    f.note.value = x.note || "";
    f.date.value = x.date;
    $("#expenseTitle").textContent = "Ubah transaksi";
    modal("expenseModal");
  }
  if ((id = e.target.dataset.delete)) {
    if (confirm("Hapus transaksi ini?")) {
      data.transactions = data.transactions.filter((x) => x.id !== id);
      save();
      toast("Transaksi dihapus");
    }
  }
  if ((id = e.target.dataset.removeBudget)) {
    const settings = getMonthSettings();
    delete settings.categoryBudgets[id];
    data.monthSettings[selectedMonth] = settings;
    save();
  }
  if ((id = e.target.dataset.depositGoal)) {
    const goal = data.goals.find((item) => item.id === id), amount = number(prompt(`Setor ke ${goal.name} (Rp)`));
    if (amount) { goal.saved += amount; goal.deposits ||= []; goal.deposits.push({ id: crypto.randomUUID(), amount, date: new Date().toISOString().slice(0, 10) }); save(); toast("Setoran target berhasil disimpan"); }
  }
  if ((id = e.target.dataset.deleteGoal)) {
    data.goals = data.goals.filter((x) => x.id !== id);
    save();
  }
  if ((id = e.target.dataset.removeRecurring)) {
    data.recurring = data.recurring.filter((x) => x.id !== id);
    save();
    renderRecurring();
  }
};
$("#dashboardMonth").value = selectedMonth;
$("#transactionMonth").value = selectedMonth;
if ($("#chartCustomMonth")) $("#chartCustomMonth").value = chartCustomMonthValue;
$("#dashboardMonth").onchange = $("#transactionMonth").onchange = (event) => { selectedMonth = event.target.value || new Date().toISOString().slice(0, 7); $("#dashboardMonth").value = selectedMonth; $("#transactionMonth").value = selectedMonth; render(); };
if ($("#toggleIncomeLine")) {
  $("#toggleIncomeLine").onclick = () => {
    chartVisibility.income = !chartVisibility.income;
    $("#toggleIncomeLine").classList.toggle("active", chartVisibility.income);
    $("#toggleIncomeLine").setAttribute("aria-pressed", String(chartVisibility.income));
    renderChart();
  };
}
if ($("#toggleExpenseLine")) {
  $("#toggleExpenseLine").onclick = () => {
    chartVisibility.expense = !chartVisibility.expense;
    $("#toggleExpenseLine").classList.toggle("active", chartVisibility.expense);
    $("#toggleExpenseLine").setAttribute("aria-pressed", String(chartVisibility.expense));
    renderChart();
  };
}
if ($("#chartPeriod")) {
  $("#chartPeriod").onchange = (e) => {
    chartPeriodMode = e.target.value;
    if (chartPeriodMode === "customMonth") {
      $("#chartCustomMonth").style.display = "inline-block";
      $("#chartCustomMonth").value = chartCustomMonthValue;
    } else {
      $("#chartCustomMonth").style.display = "none";
    }
    renderChart();
  };
}
if ($("#chartCustomMonth")) {
  $("#chartCustomMonth").onchange = (e) => {
    chartCustomMonthValue = e.target.value || new Date().toISOString().slice(0, 7);
    renderChart();
  };
}
$("#expenseForm").type.onchange = refreshCategoryInputs;
$$('[data-quick-amount]').forEach((button) => button.onclick = () => { $("#expenseForm").amount.value = money(+button.dataset.quickAmount); });
$("#searchTx").oninput = renderTx;
$("#filterCategory").onchange =
  $("#filterType").onchange =
  $("#filterFrom").onchange =
  $("#filterTo").onchange =
    renderTx;
$("#clearFilters").onclick = () => {
  $("#searchTx").value = "";
  $("#filterCategory").value = "";
  $("#filterType").value = "";
  $("#filterFrom").value = "";
  $("#filterTo").value = "";
  renderTx();
};
function renderRecurring() {
  $("#recurringList").innerHTML =
    data.recurring
      .map(
        (x) =>
          `<div class="recurring-row"><span>${x.name}<small>${x.category} · tiap tanggal ${x.day}</small></span><b>${money(x.amount)}</b><button data-remove-recurring="${x.id}">×</button></div>`,
      )
      .join("") || '<p class="subtitle">Belum ada transaksi rutin.</p>';
}
$("#exportCsv").onclick = () => {
  let csv =
    "Nama,Kategori,Jenis,Nominal,Tanggal\n" +
    data.transactions
      .map(
        (x) =>
          `"${x.name}",${x.category},${x.income ? "Pemasukan" : "Pengeluaran"},${x.amount},${x.date}`,
      )
      .join("\n");
  download(csv, "laporan-ruangdana.csv", "text/csv");
  toast("Laporan CSV berhasil diunduh");
};
function download(text, name, type) {
  let a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([text], { type }));
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
$("#backupData").onclick = () =>
  download(
    JSON.stringify(data, null, 2),
    "backup-ruangdana.json",
    "application/json",
  );
$("#restoreData").onchange = (e) => {
  let r = new FileReader();
  r.onload = () => {
    try {
      data = JSON.parse(r.result);
      save();
      toast("Data berhasil dipulihkan");
    } catch {
      toast("File backup tidak valid");
    }
  };
  r.readAsText(e.target.files[0]);
};
$("#toggleTheme").onclick = () => {
  document.body.classList.toggle("dark");
  localStorage.setItem(
    "ruangDanaTheme",
    document.body.classList.contains("dark"),
  );
  $("#toggleTheme").textContent = document.body.classList.contains("dark")
    ? "Gunakan mode terang"
    : "Aktifkan mode gelap";
};
if (localStorage.getItem("ruangDanaTheme") === "true")
  $("#toggleTheme").click();
$("#enableReminder").onclick = async () => {
  if (!("Notification" in window))
    return toast("Browser tidak mendukung notifikasi");
  let p = await Notification.requestPermission();
  $("#reminderStatus").textContent =
    p === "granted"
      ? "Notifikasi browser aktif."
      : "Izin notifikasi belum diberikan.";
  if (p === "granted") {
    new Notification("RuangDana siap mengingatkanmu");
    toast("Notifikasi berhasil diaktifkan");
  }
};
$("#notificationButton").onclick = () =>
  toast("Pantau batas anggaranmu secara berkala.");
$("#resetData").onclick = () => {
  if (confirm("Kembalikan data contoh?")) {
    data = structuredClone(base);
    save();
  }
};
function setSyncStatus(state, detail = "") {
  const labels = { saving: "● Menyimpan perubahan…", synced: "● Tersinkron", error: "● Gagal sinkron", offline: "● Belum tersinkron" };
  $("#syncStatus").textContent = labels[state];
  $("#syncStatus").dataset.state = state;
  if (detail) $("#cloudStatusDetail").textContent = detail;
}
async function loadCloudData() {
  setSyncStatus("saving", "Memuat data dari cloud…");
  const { data: row, error } = await supabaseClient.from("user_data").select("data").eq("user_id", currentUser.id).maybeSingle();
  if (error) { setSyncStatus("error", "Data cloud gagal dimuat."); return toast("Gagal memuat data cloud."); }
  if (row?.data && Object.keys(row.data).length) data = row.data;
  else await save();
  normalizeData();
  setSyncStatus("synced", "Data cloud berhasil dimuat.");
  localStorage.setItem("ruangDanaPro", JSON.stringify(data));
  refreshCategoryInputs();
  renderCategoryManager();
  render();
}
function setAuthMessage(message = "") { $("#authMessage").textContent = message; }
function setAuthenticated(user) {
  currentUser = user;
  $("#authScreen").classList.add("hidden");
  $("#profileEmail").textContent = user.email || "Akun terhubung";
  $("#profileName").textContent = user.email?.split("@")[0] || "RuangDana";
  $("#profileAvatar").textContent = (user.email || "RD").slice(0, 2).toUpperCase();
  loadCloudData();
}
async function initAuth() {
  const config = window.SUPABASE_CONFIG;
  if (!config || config.url.includes("PASTE_") || config.anonKey.includes("PASTE_")) {
    setAuthMessage("Konfigurasi Supabase belum diisi. Lihat file supabase-config.js.");
    return;
  }
  supabaseClient = window.supabase.createClient(config.url, config.anonKey);
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session?.user) setAuthenticated(session.user);
  supabaseClient.auth.onAuthStateChange((_event, sessionState) => { if (sessionState?.user && !currentUser) setAuthenticated(sessionState.user); });
}
$("#authSwitch").onclick = () => {
  authMode = authMode === "login" ? "signup" : "login";
  $("#authTitle").textContent = authMode === "login" ? "Masuk ke akunmu" : "Buat akun baru";
  $("#authHint").textContent = authMode === "login" ? "Masuk agar data keuanganmu tersimpan dan sama di semua perangkat." : "Daftar untuk menyimpan data keuanganmu secara privat di cloud.";
  $("#authSubmit").textContent = authMode === "login" ? "Masuk" : "Daftar";
  $("#authSwitch").textContent = authMode === "login" ? "Belum punya akun? Daftar" : "Sudah punya akun? Masuk";
  $("#authForm").password.autocomplete = authMode === "login" ? "current-password" : "new-password";
  setAuthMessage();
};
$("#syncNow").onclick = () => currentUser ? save().then(() => toast("Sinkronisasi selesai")) : toast("Silakan masuk terlebih dahulu");
$("#logoutButton").onclick = async () => { if (supabaseClient) await supabaseClient.auth.signOut(); location.reload(); };
$("#resetPassword").onclick = async () => { if (!supabaseClient || !currentUser?.email) return toast("Email akun belum tersedia"); const { error } = await supabaseClient.auth.resetPasswordForEmail(currentUser.email, { redirectTo: location.href }); toast(error ? "Gagal mengirim link reset" : "Link reset password dikirim ke emailmu"); };
$("#changePassword").onclick = async () => { const password = prompt("Masukkan kata sandi baru (minimal 6 karakter):"); if (!password || password.length < 6 || !supabaseClient) return toast("Kata sandi minimal 6 karakter"); const { error } = await supabaseClient.auth.updateUser({ password }); toast(error ? "Gagal mengubah kata sandi" : "Kata sandi berhasil diubah"); };
$("#authForm").onsubmit = async (e) => {
  e.preventDefault();
  if (!supabaseClient) return setAuthMessage("Isi konfigurasi Supabase terlebih dahulu.");
  const email = e.target.email.value.trim(), password = e.target.password.value;
  $("#authSubmit").disabled = true;
  setAuthMessage();
  const result = authMode === "login"
    ? await supabaseClient.auth.signInWithPassword({ email, password })
    : await supabaseClient.auth.signUp({ email, password });
  $("#authSubmit").disabled = false;
  if (result.error) return setAuthMessage(result.error.message);
  if (result.data.user && !result.data.session) return setAuthMessage("Cek email untuk mengonfirmasi akun, lalu masuk.");
  setAuthenticated(result.data.user);
};
initAuth();
refreshCategoryInputs();
renderCategoryManager();
$("#today").textContent = new Date()
  .toLocaleDateString("id-ID", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  .toUpperCase();
render();
if (location.hash && $(location.hash)) go(location.hash.slice(1));
