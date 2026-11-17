/* LifeDrop admin panel – talks to the FastAPI backend */
const API_ROOT = window.LIFEDROP_API;
const API = `${API_ROOT}/api`;
const TOKEN_KEY = "lifedrop_admin_token";

let token = localStorage.getItem(TOKEN_KEY) || "";
let campImage = "";          // image url of the camp being edited
const $ = (id) => document.getElementById(id);

/* ---------------- helpers ---------------- */
function esc(v) {
    return String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}
function assetUrl(p) { return !p ? "" : (p.startsWith("/") ? API_ROOT + p : p); }
function fmtDate(v) {
    if (!v) return "";
    const d = new Date(/[zZ]|[+-]\d\d:?\d\d$/.test(v) || v.length <= 10 ? v : v + "Z");
    return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
let toastTimer;
function toast(msg, isError = false) {
    const t = $("toast");
    t.textContent = msg;
    t.className = "toast show" + (isError ? " error" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.className = "toast"), 3200);
}
function errText(data, fallback) {
    if (!data) return fallback;
    if (typeof data.detail === "string") return data.detail;
    if (Array.isArray(data.detail)) return data.detail.map(d => d.msg).join(", ");
    return fallback;
}
async function api(path, { method = "GET", body, form } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload;
    if (form) payload = form;
    else if (body !== undefined) { headers["Content-Type"] = "application/json"; payload = JSON.stringify(body); }
    let res;
    try { res = await fetch(API + path, { method, headers, body: payload }); }
    catch { throw new Error("Cannot reach the backend. Is FastAPI running on port 8000?"); }
    let data = null;
    try { data = await res.json(); } catch { /* empty body */ }
    if (res.status === 401 && path !== "/admin/login") {
        logout();
        throw new Error("Session expired. Please login again.");
    }
    if (!res.ok) throw new Error(errText(data, `Request failed (${res.status})`));
    return data;
}
async function uploadImage(file) {
    const form = new FormData();
    form.append("file", file);
    const data = await api("/upload", { method: "POST", form });
    return data.url;
}
async function run(button, fn) {           // disable a button while an async action runs
    if (button) button.disabled = true;
    try { await fn(); } catch (e) { toast(e.message, true); }
    finally { if (button) button.disabled = false; }
}

/* ---------------- login / logout ---------------- */
function showLogin() { $("app").hidden = true; $("loginScreen").hidden = false; }
function showApp() {
    $("loginScreen").hidden = true; $("app").hidden = false;
    switchView("dashboard");
}
function logout() {
    token = ""; localStorage.removeItem(TOKEN_KEY); showLogin();
}
$("logoutBtn").addEventListener("click", logout);

$("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();
    run(e.submitter, async () => {
        const username = $("loginUser").value.trim();
        const data = await api("/admin/login", { method: "POST", body: { username, password: $("loginPass").value } });
        token = data.access_token;
        localStorage.setItem(TOKEN_KEY, token);
        $("adminName").textContent = username;
        $("adminInitial").textContent = username.charAt(0).toUpperCase() || "A";
        $("loginPass").value = "";
        showApp();
    });
});

/* ---------------- navigation ---------------- */
const TITLES = {
    dashboard: "Admin Dashboard", camps: "Blood Camps", gallery: "Gallery", messages: "Messages",
    donors: "Donors", volunteers: "Volunteers", settings: "Site Settings", account: "Account",
};
const LOADERS = {
    dashboard: loadDashboard, camps: loadCamps, gallery: loadGallery, messages: loadMessages,
    donors: loadDonors, volunteers: loadVolunteers, settings: loadSettings, account: () => {},
};
function switchView(name) {
    document.querySelectorAll(".view").forEach(v => (v.hidden = v.id !== `view-${name}`));
    document.querySelectorAll(".sidebar a[data-view]").forEach(a =>
        a.classList.toggle("active-side", a.dataset.view === name));
    $("pageTitle").textContent = TITLES[name];
    LOADERS[name]().catch(e => toast(e.message, true));
}
document.querySelectorAll(".sidebar a[data-view]").forEach(a =>
    a.addEventListener("click", (e) => { e.preventDefault(); switchView(a.dataset.view); }));
document.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => {
    switchView(b.dataset.go);
    if (b.dataset.focus) setTimeout(() => $(b.dataset.focus)?.focus(), 50);
}));

/* ---------------- dashboard ---------------- */
async function loadDashboard() {
    const [stats, messages] = await Promise.all([api("/dashboard/stats"), api("/messages")]);
    $("statDonors").textContent = stats.donors;
    $("statCamps").textContent = stats.upcoming_camps !== undefined ? `${stats.upcoming_camps} / ${stats.camps}` : stats.camps;
    $("statVolunteers").textContent = stats.volunteers;
    $("statMessages").textContent = stats.messages;
    setMsgBadge(stats.messages);
    $("recentMessages").innerHTML = messages.length
        ? messages.slice(0, 5).map(m => `
            <div class="activity">
              <div class="activity-icon">✉</div>
              <div><h3>${esc(m.name)} ${m.is_read ? "" : '<span class="badge">NEW</span>'}</h3>
                   <p>${esc((m.subject && m.subject !== "Select Subject" ? m.subject + " — " : "") + m.message.trim().slice(0, 80))}</p></div>
              <span>${fmtDate(m.created_at)}</span>
            </div>`).join("")
        : '<p class="empty">No messages yet.</p>';
}
function setMsgBadge(n) {
    $("navMsgCount").textContent = n;
    $("navMsgCount").hidden = !n;
}

/* ---------------- camps ---------------- */
function setCampImage(url) {
    campImage = url || "";
    $("campPreview").innerHTML = campImage ? `<img src="${esc(assetUrl(campImage))}" alt="">` : "No photo";
    $("campRemoveImg").hidden = !campImage;
}
function resetCampForm() {
    $("campForm").reset(); $("campId").value = "";
    setCampImage("");
    $("campFormTitle").textContent = "Add New Camp";
    $("campCancel").hidden = true;
}
$("campFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    run(null, async () => { setCampImage(await uploadImage(file)); toast("Photo uploaded"); })
        .finally(() => (e.target.value = ""));
});
$("campRemoveImg").addEventListener("click", () => setCampImage(""));
$("campCancel").addEventListener("click", resetCampForm);

$("campForm").addEventListener("submit", (e) => {
    e.preventDefault();
    run($("campSave"), async () => {
        const body = {
            title: $("campTitle").value.trim(),
            camp_date: $("campDate").value,
            location: $("campLocation").value.trim(),
            description: $("campDesc").value.trim() || null,
            image: campImage || null,
        };
        const id = $("campId").value;
        await api(id ? `/camps/${id}` : "/camps", { method: id ? "PUT" : "POST", body });
        toast(id ? "Camp updated" : "Camp added");
        resetCampForm();
        await loadCamps();
    });
});

function campBadge(d) {
    const today = new Date().toISOString().slice(0, 10);
    return d < today ? '<span class="badge past">Past</span>' : '<span class="badge soon">Upcoming</span>';
}
let campsCache = [];
async function loadCamps() {
    campsCache = await api("/camps");
    $("campList").innerHTML = campsCache.length ? `
      <table class="data-table"><thead><tr><th>Photo</th><th>Camp</th><th>Date</th><th>Location</th><th></th></tr></thead><tbody>
      ${campsCache.map(c => `<tr>
        <td>${c.image ? `<img class="thumb" src="${esc(assetUrl(c.image))}" alt="">` : '<span class="thumb" style="display:flex;align-items:center;justify-content:center">🩸</span>'}</td>
        <td><strong>${esc(c.title)}</strong> ${campBadge(c.camp_date)}</td>
        <td>${fmtDate(c.camp_date)}</td>
        <td>${esc(c.location)}</td>
        <td><div class="row-actions">
          <button class="btn-admin btn-ghost btn-sm" data-edit-camp="${c.id}">Edit</button>
          <button class="btn-admin btn-danger btn-sm" data-del-camp="${c.id}">Delete</button>
        </div></td></tr>`).join("")}
      </tbody></table>` : '<p class="empty">No camps yet. Add your first camp above.</p>';
}
$("campList").addEventListener("click", (e) => {
    const edit = e.target.closest("[data-edit-camp]");
    const del = e.target.closest("[data-del-camp]");
    if (edit) {
        const c = campsCache.find(x => x.id == edit.dataset.editCamp);
        if (!c) return;
        $("campId").value = c.id; $("campTitle").value = c.title;
        $("campDate").value = c.camp_date; $("campLocation").value = c.location;
        $("campDesc").value = c.description || "";
        setCampImage(c.image);
        $("campFormTitle").textContent = "Edit Camp";
        $("campCancel").hidden = false;
        window.scrollTo({ top: 0, behavior: "smooth" });
    } else if (del && confirm("Delete this camp?")) {
        run(del, async () => { await api(`/camps/${del.dataset.delCamp}`, { method: "DELETE" }); toast("Camp deleted"); await loadCamps(); });
    }
});

/* ---------------- gallery ---------------- */
$("galleryForm").addEventListener("submit", (e) => {
    e.preventDefault();
    run($("gallerySave"), async () => {
        const files = [...$("galleryFiles").files];
        const caption = $("galleryCaption").value.trim() || null;
        let done = 0;
        for (const file of files) {
            toast(`Uploading ${++done} of ${files.length}…`);
            const url = await uploadImage(file);
            await api("/gallery", { method: "POST", body: { image: url, caption } });
        }
        $("galleryForm").reset();
        toast(`${files.length} photo(s) uploaded`);
        await loadGallery();
    });
});
async function loadGallery() {
    const items = await api("/gallery");
    $("galleryList").innerHTML = items.length
        ? `<div class="admin-gallery">${items.map(g => `
            <div class="g-item"><img src="${esc(assetUrl(g.image))}" alt="">
              <div class="g-meta"><span>${esc(g.caption || "No caption")}</span>
                <button class="btn-admin btn-danger btn-sm" data-del-gallery="${g.id}">Delete</button></div></div>`).join("")}</div>`
        : '<p class="empty">No photos yet.</p>';
}
$("galleryList").addEventListener("click", (e) => {
    const del = e.target.closest("[data-del-gallery]");
    if (del && confirm("Delete this photo?"))
        run(del, async () => { await api(`/gallery/${del.dataset.delGallery}`, { method: "DELETE" }); toast("Photo deleted"); await loadGallery(); });
});

/* ---------------- messages ---------------- */
async function loadMessages() {
    const list = await api("/messages");
    setMsgBadge(list.filter(m => !m.is_read).length);
    $("messageList").innerHTML = list.length ? list.map(m => `
      <div class="msg ${m.is_read ? "" : "unread"}">
        <div class="msg-head">
          <div><strong>${esc(m.name)}</strong> ${m.is_read ? '<span class="badge read">Read</span>' : '<span class="badge">New</span>'}<br>
            <span class="muted">${esc(m.email)}${m.phone ? " · " + esc(m.phone) : ""}${m.subject && m.subject !== "Select Subject" ? " · " + esc(m.subject) : ""}</span></div>
          <span class="muted">${fmtDate(m.created_at)}</span>
        </div>
        <p class="body">${esc(m.message.trim())}</p>
        <div class="row-actions" style="justify-content:flex-start">
          <a class="btn-admin btn-ghost btn-sm" style="text-decoration:none" href="mailto:${esc(m.email)}">Reply by email</a>
          ${m.is_read ? "" : `<button class="btn-admin btn-ghost btn-sm" data-read-msg="${m.id}">Mark as read</button>`}
          <button class="btn-admin btn-danger btn-sm" data-del-msg="${m.id}">Delete</button>
        </div>
      </div>`).join("") : '<p class="empty">No messages yet.</p>';
}
$("messageList").addEventListener("click", (e) => {
    const read = e.target.closest("[data-read-msg]");
    const del = e.target.closest("[data-del-msg]");
    if (read) run(read, async () => { await api(`/messages/${read.dataset.readMsg}/read`, { method: "PATCH" }); await loadMessages(); });
    else if (del && confirm("Delete this message?"))
        run(del, async () => { await api(`/messages/${del.dataset.delMsg}`, { method: "DELETE" }); toast("Message deleted"); await loadMessages(); });
});

/* ---------------- donors & volunteers ---------------- */
function personTable(rows, kind) {
    if (!rows.length) return `<p class="empty">No ${kind}s yet.</p>`;
    const isDonor = kind === "donor";
    return `<table class="data-table"><thead><tr><th>Name</th>${isDonor ? "<th>Blood</th>" : ""}<th>Phone</th><th>Email</th><th>Added</th><th></th></tr></thead><tbody>
      ${rows.map(r => `<tr><td><strong>${esc(r.name)}</strong></td>
        ${isDonor ? `<td><span class="badge">${esc(r.blood_group)}</span></td>` : ""}
        <td>${esc(r.phone)}</td><td>${esc(r.email || "–")}</td><td>${fmtDate(r.created_at)}</td>
        <td><div class="row-actions"><button class="btn-admin btn-danger btn-sm" data-del-${kind}="${r.id}">Delete</button></div></td></tr>`).join("")}
      </tbody></table>`;
}
let donorsCache = [], volunteersCache = [];

function toolbar(kind) {
    const group = kind === "donor"
        ? `<select data-filter-group="${kind}"><option value="">All blood groups</option>
             ${["A+","A-","B+","B-","AB+","AB-","O+","O-"].map(g => `<option>${g}</option>`).join("")}</select>` : "";
    return `<div class="table-tools">
        <input type="search" placeholder="Search name / phone / email" data-search="${kind}">
        ${group}<span class="spacer"></span>
        <button class="btn-admin btn-ghost btn-sm" type="button" data-export="${kind}">⬇ Export CSV</button>
        <span class="muted" data-count="${kind}"></span>
      </div><div data-table="${kind}"></div>`;
}
function filteredPeople(kind) {
    const rows = kind === "donor" ? donorsCache : volunteersCache;
    const q = (document.querySelector(`[data-search="${kind}"]`)?.value || "").toLowerCase().trim();
    const g = document.querySelector(`[data-filter-group="${kind}"]`)?.value || "";
    return rows.filter(r =>
        (!g || r.blood_group === g) &&
        (!q || [r.name, r.phone, r.email].some(v => (v || "").toLowerCase().includes(q))));
}
function renderPeople(kind) {
    const rows = filteredPeople(kind);
    document.querySelector(`[data-table="${kind}"]`).innerHTML = personTable(rows, kind);
    document.querySelector(`[data-count="${kind}"]`).textContent = `${rows.length} shown`;
}
function mountPeople(listEl, kind, rows) {
    if (kind === "donor") donorsCache = rows; else volunteersCache = rows;
    if (!listEl.querySelector(`[data-table="${kind}"]`)) listEl.innerHTML = toolbar(kind);
    renderPeople(kind);
}
function csvCell(v) {
    let t = String(v ?? "");
    if (/^[=+\-@]/.test(t)) t = "'" + t;          // stop spreadsheet formula injection
    return `"${t.replaceAll('"', '""')}"`;
}
function exportCsv(kind) {
    const rows = filteredPeople(kind);
    const head = kind === "donor" ? ["Name", "Blood group", "Phone", "Email", "Added"] : ["Name", "Phone", "Email", "Added"];
    const lines = [head.map(csvCell).join(",")].concat(rows.map(r =>
        (kind === "donor" ? [r.name, r.blood_group, r.phone, r.email, r.created_at] : [r.name, r.phone, r.email, r.created_at])
            .map(csvCell).join(",")));
    const blob = new Blob(["\ufeff" + lines.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `lifedrop-${kind}s-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
}
async function loadDonors() { mountPeople($("donorList"), "donor", await api("/donors")); }
async function loadVolunteers() { mountPeople($("volList"), "volunteer", await api("/volunteers")); }
for (const [el, kind] of [[$("donorList"), "donor"], [$("volList"), "volunteer"]]) {
    el.addEventListener("input", (e) => { if (e.target.matches("[data-search],[data-filter-group]")) renderPeople(kind); });
    el.addEventListener("change", (e) => { if (e.target.matches("[data-filter-group]")) renderPeople(kind); });
    el.addEventListener("click", (e) => { if (e.target.closest("[data-export]")) exportCsv(kind); });
}

$("donorForm").addEventListener("submit", (e) => {
    e.preventDefault();
    run(e.submitter, async () => {
        await api("/donors", { method: "POST", body: {
            name: $("donorName").value.trim(), phone: $("donorPhone").value.trim(),
            blood_group: $("donorGroup").value, email: $("donorEmail").value.trim() || null } });
        $("donorForm").reset(); toast("Donor added"); await loadDonors();
    });
});
$("volForm").addEventListener("submit", (e) => {
    e.preventDefault();
    run(e.submitter, async () => {
        await api("/volunteers", { method: "POST", body: {
            name: $("volName").value.trim(), phone: $("volPhone").value.trim(),
            email: $("volEmail").value.trim() || null } });
        $("volForm").reset(); toast("Volunteer added"); await loadVolunteers();
    });
});
$("donorList").addEventListener("click", (e) => {
    const del = e.target.closest("[data-del-donor]");
    if (del && confirm("Delete this donor?"))
        run(del, async () => { await api(`/donors/${del.dataset.delDonor}`, { method: "DELETE" }); toast("Donor deleted"); await loadDonors(); });
});
$("volList").addEventListener("click", (e) => {
    const del = e.target.closest("[data-del-volunteer]");
    if (del && confirm("Delete this volunteer?"))
        run(del, async () => { await api(`/volunteers/${del.dataset.delVolunteer}`, { method: "DELETE" }); toast("Volunteer deleted"); await loadVolunteers(); });
});

/* ---------------- site settings ---------------- */
function setQr(url) {
    $("qrValue").value = url || "";
    $("qrPreview").innerHTML = url ? `<img src="${esc(assetUrl(url))}" alt="QR">` : "No QR";
    $("qrRemove").hidden = !url;
}
async function loadSettings() {
    const s = await api("/settings");
    document.querySelectorAll("[data-setting]").forEach(el => (el.value = s[el.dataset.setting] ?? ""));
    setQr(s.qr_image);
}
$("qrFile").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    run(null, async () => { setQr(await uploadImage(file)); toast("QR uploaded – click Save All Changes to publish it"); })
        .finally(() => (e.target.value = ""));
});
$("qrRemove").addEventListener("click", () => setQr(""));
$("settingsForm").addEventListener("submit", (e) => {
    e.preventDefault();
    run($("settingsSave"), async () => {
        const body = {};
        document.querySelectorAll("[data-setting]").forEach(el => (body[el.dataset.setting] = el.value.trim()));
        await api("/settings", { method: "PUT", body });
        toast("Website updated ✔");
    });
});

/* ---------------- account ---------------- */
$("passwordForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if ($("newPass").value !== $("newPass2").value) return toast("New passwords do not match", true);
    run(e.submitter, async () => {
        await api("/admin/change-password", { method: "POST", body: {
            current_password: $("curPass").value, new_password: $("newPass").value } });
        $("passwordForm").reset(); toast("Password changed");
    });
});

/* ---------------- start ---------------- */
if (token) {
    api("/dashboard/stats").then(() => showApp()).catch(() => showLogin());
} else {
    showLogin();
}
