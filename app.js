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
  const previousUsed = sum(monthTransactions(previousDate.toISOString().slice(0, 7)).filter((transaction) => !transaction.income));
  const change = previousUsed ? Math.round(((used - previousUsed) / previousUsed) * 100) : 0;
  $("#summaryTitle").textContent = `Ringkasan ${monthLabel(selectedMonth)}`;
  $("#balance").textContent = money(saved);
  $("#incomeTotal").textContent = money(totalIncome);
  $("#expenseTotal").textContent = money(used);
  $("#savingsRate").textContent = `${Math.round(sp)}% tersisa`;
  $("#budgetLimit").textContent = money(settings.budget);
  $("#budgetRemaining").textContent = `Sisa ${money(Math.max(0, settings.budget - used))} yang bisa dipakai`;
  $("#savingTotal").textContent = money(saved);
  $("#budgetProgressText").textContent = settings.budget
    ? `${money(used)} terpakai · ${daysRemaining()} hari tersisa`
    : "Belum ada anggaran";
  $("#budgetPct").textContent = Math.round(bp) + "%";
  $("#savingPct").textContent = Math.round(sp) + "%";
  $("#budgetBar").style.width = bp + "%";
  $("#savingBar").style.width = sp + "%";
  const todayKey = new Date().toISOString().slice(0, 10), isCurrentMonth = selectedMonth === todayKey.slice(0, 7), todayUsed = isCurrentMonth ? sum(expenses.filter((transaction) => transaction.date === todayKey)) : 0, dailyPct = settings.dailyBudget ? Math.min(100, (todayUsed / settings.dailyBudget) * 100) : 0;
  $("#dailyBudgetLimit").textContent = money(settings.dailyBudget);
  $("#dailyBudgetRemaining").textContent = `Sisa ${money(Math.max(0, settings.dailyBudget - todayUsed))} yang bisa dipakai`;
  $("#dailyProgressText").textContent = !isCurrentMonth ? "Batas harian hanya untuk bulan berjalan" : settings.dailyBudget ? `${money(todayUsed)} terpakai hari ini` : "Belum ada batas harian";
  $("#dailyPct").textContent = Math.round(dailyPct) + "%";
  $("#dailyBar").style.width = dailyPct + "%";
  $("#dailyBar").style.background = dailyPct >= 90 ? "#df765d" : "";
  $("#budgetLarge").textContent = money(settings.budget);
  $("#budgetExplanation").textContent = settings.budget
    ? `${money(used)} terpakai. Sisa ${money(Math.max(0, settings.budget - used))}; rata-rata aman ${money(Math.floor(Math.max(0, settings.budget - used) / daysRemaining()))}/hari untuk ${daysRemaining()} hari.`
    : "Belum ada anggaran yang ditetapkan.";
  $("#budgetBarLarge").style.width = bp + "%";
  const budgetState = bp >= 100 ? "danger" : bp >= 75 ? "warning" : "safe";
  ["#budgetBar", "#dailyBar", "#budgetBarLarge"].forEach((selector) => $(selector).dataset.state = budgetState);
  $("#insightText").textContent = bp >= 100 ? "Batas bulanan sudah terlampaui. Tahan pengeluaran yang tidak mendesak." : bp >= 75 ? `Sisa ${money(Math.max(0, settings.budget - used))}. Batas bulanan mulai menipis.` : previousUsed ? `Pengeluaran ${change <= 0 ? "turun" : "naik"} ${Math.abs(change)}% dibanding bulan lalu.` : `Kamu masih memiliki ${money(saved)} untuk ditabung atau dialokasikan.`;
  $("#notificationDot").style.display = bp >= 75 ? "block" : "none";
  renderCategories(expenses);
  renderTx();
  renderBudgets();
  renderGoals();
  renderChart();
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
function renderChart() {
  $("#chartBars").innerHTML = [0.28, 0.48, 0.35, 0.72, 0.42, 0.63, 0.5]
    .map(
      (v, i) =>
        `<div class="bar-group"><span class="bar income-bar" style="height:${v * 100}%"></span><span class="bar expense-bar" style="height:${(v * 0.65 + (i % 2) * 0.12) * 100}%"></span></div>`,
    )
    .join("");
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
$("#dashboardMonth").onchange = $("#transactionMonth").onchange = (event) => { selectedMonth = event.target.value || new Date().toISOString().slice(0, 7); $("#dashboardMonth").value = selectedMonth; $("#transactionMonth").value = selectedMonth; render(); };
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
