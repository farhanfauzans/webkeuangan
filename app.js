const cats = [
  "Makanan & Minuman",
  "Transportasi",
  "Belanja",
  "Tagihan",
  "Hiburan",
  "Kesehatan",
  "Lainnya",
];
const base = {
  income: 8000000,
  budget: 5000000,
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
};
let data = JSON.parse(localStorage.getItem("ruangDanaPro")) || base;
const $ = (s) => document.querySelector(s),
  $$ = (s) => [...document.querySelectorAll(s)],
  money = (n) => "Rp" + new Intl.NumberFormat("id-ID").format(n || 0),
  number = (v) => Number(String(v).replace(/\D/g, "")) || 0,
  save = () => {
    localStorage.setItem("ruangDanaPro", JSON.stringify(data));
    render();
  };
const icon = (c) =>
  ({
    "Makanan & Minuman": "☕",
    Transportasi: "⌁",
    Belanja: "◈",
    Tagihan: "▤",
    Hiburan: "♫",
    Kesehatan: "✚",
    Pemasukan: "↓",
    Lainnya: "•",
  })[c] || "•";
const date = (d) =>
  new Date(d + "T00:00:00").toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
const exp = () => data.transactions.filter((x) => !x.income),
  sum = (a) => a.reduce((s, x) => s + x.amount, 0);
function toast(t) {
  $("#toast").textContent = t;
  $("#toast").classList.add("show");
  setTimeout(() => $("#toast").classList.remove("show"), 3200);
}
function options(id, includeIncome = false) {
  $(id).innerHTML = (includeIncome ? ["Pemasukan", ...cats] : cats)
    .map((x) => `<option>${x}</option>`)
    .join("");
}
function render() {
  const used = sum(exp()),
    saved = Math.max(data.income - used, 0),
    bp = data.budget ? Math.min(100, (used / data.budget) * 100) : 0,
    sp = data.income ? Math.min(100, (saved / data.income) * 100) : 0;
  $("#balance").textContent = money(data.income - used);
  $("#incomeTotal").textContent = money(data.income);
  $("#expenseTotal").textContent = money(used);
  $("#savingsRate").textContent = `${Math.round(sp)}% tersisa`;
  $("#budgetLimit").textContent = money(data.budget);
  $("#savingTotal").textContent = money(saved);
  $("#budgetProgressText").textContent = data.budget
    ? `${money(used)} terpakai`
    : "Belum ada anggaran";
  $("#budgetPct").textContent = Math.round(bp) + "%";
  $("#savingPct").textContent = Math.round(sp) + "%";
  $("#budgetBar").style.width = bp + "%";
  $("#savingBar").style.width = sp + "%";
  $("#budgetLarge").textContent = money(data.budget);
  $("#budgetExplanation").textContent = data.budget
    ? `${money(used)} telah digunakan dari batas bulanan.`
    : "Belum ada anggaran yang ditetapkan.";
  $("#budgetBarLarge").style.width = bp + "%";
  $("#insightText").textContent =
    bp >= 90
      ? "Batas anggaran hampir habis. Tunda belanja yang tidak mendesak."
      : `Kamu masih memiliki ${money(saved)} untuk ditabung atau dialokasikan.`;
  $("#notificationDot").style.display = bp >= 80 ? "block" : "none";
  renderCategories();
  renderTx();
  renderBudgets();
  renderGoals();
  renderChart();
}
function renderCategories() {
  let o = {};
  exp().forEach((x) => (o[x.category] = (o[x.category] || 0) + x.amount));
  let rows = Object.entries(o).sort((a, b) => b[1] - a[1]),
    max = rows[0]?.[1] || 1;
  $("#categoryList").innerHTML = rows.length
    ? rows
        .map(
          ([c, n]) =>
            `<div class="category-row"><span class="category-icon">${icon(c)}</span><div><b>${c}</b><small>${Math.round((n / sum(exp())) * 100)}% dari total</small></div><strong>${money(n)}</strong><div class="mini-bar"><i style="width:${(n / max) * 100}%"></i></div></div>`,
        )
        .join("")
    : '<p class="subtitle">Belum ada pengeluaran.</p>';
}
function txHTML(x) {
  return `<div class="transaction-row"><span class="tx-icon">${icon(x.category)}</span><div><div class="tx-name">${x.name}</div><div class="tx-meta">${x.category} · ${date(x.date)}</div></div><strong class="tx-amount ${x.income ? "positive-amount" : "negative"}">${x.income ? "+" : "-"}${money(x.amount)}</strong><div class="tx-actions"><button data-edit="${x.id}" title="Ubah">✎</button><button data-delete="${x.id}" title="Hapus">×</button></div></div>`;
}
function renderTx() {
  let tx = [...data.transactions].sort((a, b) => b.date.localeCompare(a.date));
  $("#recentTransactions").innerHTML =
    tx.slice(0, 4).map(txHTML).join("") ||
    '<p class="subtitle">Belum ada transaksi.</p>';
  let q = $("#searchTx").value.toLowerCase(),
    c = $("#filterCategory").value,
    type = $("#filterType").value;
  $("#allTransactions").innerHTML =
    tx
      .filter(
        (x) =>
          x.name.toLowerCase().includes(q) &&
          (!c || x.category === c) &&
          (!type || (type === "income") === !!x.income),
      )
      .map(txHTML)
      .join("") || '<p class="subtitle">Tidak ada transaksi yang cocok.</p>';
}
function renderBudgets() {
  $("#categoryBudgets").innerHTML =
    Object.entries(data.categoryBudgets)
      .map(([c, l]) => {
        let used = sum(exp().filter((x) => x.category === c)),
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
        let p = Math.min(100, (g.saved / g.target) * 100);
        return `<article class="goal-card"><button data-delete-goal="${g.id}">×</button><span class="goal-icon">◎</span><h3>${g.name}</h3><strong>${money(g.saved)}</strong><small>dari ${money(g.target)}</small><div class="progress-track purple-track"><i style="width:${p}%"></i></div><p>${Math.round(p)}% tercapai</p></article>`;
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
$$(".nav-link").forEach(
  (x) =>
    (x.onclick = (e) => {
      e.preventDefault();
      go(x.dataset.page);
    }),
);
$$("[data-go]").forEach((x) => (x.onclick = () => go(x.dataset.go)));
$("#openExpense").onclick = () => {
  let f = $("#expenseForm");
  f.reset();
  f.id.value = "";
  f.date.value = new Date().toISOString().slice(0, 10);
  $("#expenseTitle").textContent = "Catat transaksi";
  modal("expenseModal");
};
$("#openBudget").onclick = $("#openBudget2").onclick = () => {
  let f = $("#budgetForm");
  f.income.value = money(data.income);
  f.budget.value = money(data.budget);
  modal("budgetModal");
};
$("#openGoal").onclick = () => modal("goalModal");
$("#addCategoryBudget").onclick = () => modal("categoryModal");
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
  if (old) Object.assign(old, x);
  else data.transactions.push(x);
  close("expenseModal");
  save();
  toast(id ? "Transaksi berhasil diperbarui" : "Transaksi berhasil disimpan");
};
$("#budgetForm").onsubmit = (e) => {
  e.preventDefault();
  data.income = number(e.target.income.value);
  data.budget = number(e.target.budget.value);
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
  });
  f.reset();
  close("goalModal");
  save();
  toast("Target tabungan dibuat");
};
$("#categoryForm").onsubmit = (e) => {
  e.preventDefault();
  data.categoryBudgets[e.target.category.value] = number(e.target.limit.value);
  close("categoryModal");
  save();
  toast("Batas kategori disimpan");
};
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
  let id = e.target.dataset.edit;
  if (id) {
    let x = data.transactions.find((y) => y.id === id),
      f = $("#expenseForm");
    f.id.value = x.id;
    f.name.value = x.name;
    f.category.value = x.category;
    f.type.value = x.income ? "income" : "expense";
    f.amount.value = money(x.amount);
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
    delete data.categoryBudgets[id];
    save();
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
$("#searchTx").oninput = renderTx;
$("#filterCategory").onchange = $("#filterType").onchange = renderTx;
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
options("#expenseCategory", true);
options("#budgetCategory");
options("#recurringCategory");
$("#filterCategory").innerHTML =
  '<option value="">Semua kategori</option>' +
  cats.map((x) => `<option>${x}</option>`).join("");
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
