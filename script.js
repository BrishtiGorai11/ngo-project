const API_ROOT = window.LIFEDROP_API;
const API_BASE = `${API_ROOT}/api`;

// "/uploads/x.jpg" -> "http://127.0.0.1:8000/uploads/x.jpg"
function assetUrl(path) {
    if (!path) return "";
    return path.startsWith("/") ? API_ROOT + path : path;
}

// ---------- small helpers for public forms ----------
function setStatus(el, text, ok) {
    if (!el) return;
    el.textContent = text;
    el.className = "form-status show " + (ok ? "ok" : "err");
}

async function postJson(path, payload) {
    let response;
    try {
        response = await fetch(`${API_BASE}${path}`, {
            method: "POST",
            headers: {"Content-Type": "application/json"},
            body: JSON.stringify(payload)
        });
    } catch {
        throw new Error("Could not reach the server. Please try again later.");
    }
    let data = null;
    try { data = await response.json(); } catch { /* empty body */ }
    if (!response.ok) {
        let msg = "Something went wrong. Please check your details and try again.";
        if (data && typeof data.detail === "string") msg = data.detail;
        else if (data && Array.isArray(data.detail) && data.detail[0]) {
            const field = (data.detail[0].loc || []).slice(-1)[0];
            msg = `Please check "${field}": ${data.detail[0].msg}`;
        }
        throw new Error(msg);
    }
    return data;
}

// ---------- contact form ----------
const contactForm = document.getElementById("contactForm");
if (contactForm) {
    contactForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const status = document.getElementById("contactStatus");
        const button = contactForm.querySelector("button[type=submit]");
        const payload = {
            name: document.getElementById("contactName").value.trim(),
            email: document.getElementById("contactEmail").value.trim(),
            phone: document.getElementById("contactPhone").value.trim() || null,
            subject: document.getElementById("contactSubject").value || null,
            message: document.getElementById("contactMessage").value.trim()
        };
        button.disabled = true;
        setStatus(status, "Sending...", true);
        try {
            await postJson("/contact", payload);
            setStatus(status, "Thank you! Your message has been sent. We will get back to you soon.", true);
            contactForm.reset();
        } catch (error) {
            setStatus(status, error.message, false);
        } finally {
            button.disabled = false;
        }
    });
}

// ---------- join as donor / volunteer ----------
const joinForm = document.getElementById("joinForm");
if (joinForm) {
    const groupSelect = document.getElementById("joinGroup");
    const syncType = () => {
        const isDonor = joinForm.joinType.value === "donor";
        groupSelect.hidden = !isDonor;
        groupSelect.required = isDonor;
    };
    joinForm.querySelectorAll("input[name=joinType]").forEach(r => r.addEventListener("change", syncType));
    syncType();

    joinForm.addEventListener("submit", async (event) => {
        event.preventDefault();
        const status = document.getElementById("joinStatus");
        const button = joinForm.querySelector("button[type=submit]");
        const isDonor = joinForm.joinType.value === "donor";
        const payload = {
            name: document.getElementById("joinName").value.trim(),
            phone: document.getElementById("joinPhone").value.trim(),
            email: document.getElementById("joinEmail").value.trim() || null
        };
        if (isDonor) payload.blood_group = groupSelect.value;
        button.disabled = true;
        setStatus(status, "Submitting...", true);
        try {
            await postJson(isDonor ? "/register/donor" : "/register/volunteer", payload);
            setStatus(status, isDonor
                ? "Thank you for registering as a blood donor! We will contact you before the next camp."
                : "Thank you for volunteering! Our team will contact you soon.", true);
            joinForm.reset();
            syncType();
        } catch (error) {
            setStatus(status, error.message, false);
        } finally {
            button.disabled = false;
        }
    });
}

async function loadCamps() {
    const container = document.getElementById("campContainer");
    if (!container) return;
    try {
        const response = await fetch(`${API_BASE}/camps`);
        if (!response.ok) throw new Error("Failed to load camps");
        const all = await response.json();
        const today = new Date().toISOString().slice(0, 10);
        const upcoming = all.filter(c => c.camp_date >= today);
        // no upcoming camps? show the latest ones marked "Completed" instead of an empty section
        const camps = upcoming.length ? upcoming : all.slice(-4).reverse();
        const isPast = !upcoming.length;
        if (!camps.length) {
            container.innerHTML = '<p class="loading-camps">No upcoming camps right now. Please check back soon!</p>';
            return;
        }
        container.innerHTML = camps.map((camp, index) => {
            const date = new Date(`${camp.camp_date}T00:00:00`);
            const formatted = date.toLocaleDateString("en-IN", {
                day: "2-digit", month: "long", year: "numeric"
            }).toUpperCase();
            const imageClass = ["image-one", "image-two", "image-three", "image-four"][index % 4];
            return `
              <div class="camp-card">
                <div class="camp-image ${imageClass}">
                  ${camp.image ? `<img src="${escapeHtml(assetUrl(camp.image))}" alt="${escapeHtml(camp.title)}">` : "<span>🩸</span>"}
                </div>
                <div class="camp-info">
                  <p class="date">${formatted}</p>
                  <h3>${escapeHtml(camp.title)}${isPast ? '<span class="camp-tag">Completed</span>' : ""}</h3>
                  <p>📍 ${escapeHtml(camp.location)}</p>
                  ${isPast ? "" : '<a href="/contact#join" target="_self">Register Now →</a>'}
                </div>
              </div>`;
        }).join("");
        observeCards();
    } catch (error) {
        console.error(error);
        container.innerHTML = '<p class="loading-camps">Could not load camps right now. Please try again later.</p>';
    }
}

function escapeHtml(value) {
    return String(value ?? "")
        .replaceAll("&", "&amp;").replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;").replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
}

// ---------- scroll reveal (content is never left invisible) ----------
const REVEAL_SELECTOR = ".stat-card, .about-image, .about-content, .section-heading, .camp-card, .gallery-item, .why-card, .donate, .story-text, .story-visual, .timeline-item, .mission-card, .contact-box, .contact-form, .join-form, .qr-box, .payment-content";
let revealObserver = null;
function observeCards() {
    document.querySelectorAll(REVEAL_SELECTOR).forEach(el => {
        if (el.dataset.rv) return;
        el.dataset.rv = "1";
        el.classList.add("reveal");
        if (!("IntersectionObserver" in window)) { el.classList.add("in"); return; }
        if (!revealObserver) {
            revealObserver = new IntersectionObserver((entries) => entries.forEach(e => {
                if (e.isIntersecting) { e.target.classList.add("in"); revealObserver.unobserve(e.target); }
            }), {threshold: 0.08, rootMargin: "0px 0px -30px 0px"});
        }
        revealObserver.observe(el);
        setTimeout(() => el.classList.add("in"), 2500);   // safety net
    });
}

// ---------- mobile menu ----------
(function () {
    const nav = document.querySelector(".navbar");
    const links = document.querySelector(".nav-links");
    if (!nav || !links) return;
    const btn = document.createElement("button");
    btn.className = "menu-toggle"; btn.type = "button"; btn.setAttribute("aria-label", "Menu"); btn.textContent = "☰";
    btn.addEventListener("click", () => { const o = links.classList.toggle("open"); btn.textContent = o ? "✕" : "☰"; });
    nav.insertBefore(btn, nav.querySelector(".nav-btn"));
})();

// ---------- count-up numbers (10K+, 500+ ...) ----------
function countUp() {
    document.querySelectorAll(".stat-card h2").forEach(el => {
        const m = el.textContent.trim().match(/^(\d+(?:\.\d+)?)(.*)$/);
        if (!m || el.dataset.cu === el.textContent) return;
        el.dataset.cu = el.textContent;
        const end = parseFloat(m[1]), suffix = m[2], t0 = performance.now();
        const step = (t) => {
            const p = Math.min((t - t0) / 1400, 1), v = Math.round(end * (1 - Math.pow(1 - p, 3)));
            el.textContent = v + suffix;
            if (p < 1) requestAnimationFrame(step);
        };
        requestAnimationFrame(step);
    });
}

// ---------- editable site content (set from the admin panel) ----------
async function applySettings() {
    try {
        const response = await fetch(`${API_BASE}/settings`);
        if (!response.ok) return;
        const s = await response.json();

        // text: <span data-s="phone"> (only replaced when a value exists)
        document.querySelectorAll("[data-s]").forEach(el => {
            const v = s[el.dataset.s];
            if (v) el.textContent = v;
        });

        // links: <a data-s-href="email" data-s-prefix="mailto:">
        document.querySelectorAll("[data-s-href]").forEach(el => {
            const v = s[el.dataset.sHref];
            if (v) el.href = (el.dataset.sPrefix || "") + v.replace(/\s+/g, "");
        });

        // images: <img data-s-src="qr_image">
        document.querySelectorAll("[data-s-src]").forEach(el => {
            const v = s[el.dataset.sSrc];
            if (v) {
                el.src = assetUrl(v);
                el.hidden = false;
                const fallback = el.dataset.sFallback && document.querySelector(el.dataset.sFallback);
                if (fallback) fallback.hidden = true;
            }
        });

        // show only when a value exists (e.g. social icons, UPI id)
        document.querySelectorAll("[data-s-show]").forEach(el => {
            el.hidden = !s[el.dataset.sShow];
        });
        // social links: <a data-s-link="instagram">
        document.querySelectorAll("[data-s-link]").forEach(el => {
            const v = s[el.dataset.sLink];
            el.hidden = !v;
            if (v) el.href = v;
        });
    } catch (error) {
        console.error("Could not load site settings", error);
    } finally {
        countUp();
    }
}

// ---------- gallery ----------
async function loadGallery() {
    const grid = document.getElementById("galleryGrid");
    if (!grid) return;
    try {
        const response = await fetch(`${API_BASE}/gallery`);
        if (!response.ok) throw new Error("Failed to load gallery");
        const items = await response.json();
        const section = document.getElementById("gallery");
        if (!items.length) { if (section) section.hidden = true; return; }
        if (section) section.hidden = false;
        grid.innerHTML = items.map(item => `
          <figure class="gallery-item">
            <img src="${escapeHtml(assetUrl(item.image))}" alt="${escapeHtml(item.caption || "LifeDrop photo")}" loading="lazy">
            ${item.caption ? `<figcaption>${escapeHtml(item.caption)}</figcaption>` : ""}
          </figure>`).join("");
        observeCards();
    } catch (error) {
        console.error(error);
    }
}

applySettings();
loadGallery();
loadCamps();
observeCards();
