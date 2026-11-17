# Changes / Enhancements

## Bugs fixed
- `requirements.txt` was missing `email-validator` -> backend crashed on fresh install (EmailStr). Added (+ `alembic`).
- `story.html` never loaded `script.js`, so admin-edited story text, footer and social links did not apply there. Fixed.
- Contact form: textarea held stray whitespace so an empty message passed `required`; "Select Subject" was saved as a real subject. Fixed (frontend + backend).
- Home page "Upcoming camps" also showed past camps. Now uses `GET /api/camps?upcoming=true` (admin still sees all).
- API address was hard-coded in 2 JS files -> now one file: `config.js`.

## Security
- Rate limiting: login (8 / 5 min), contact + sign-up forms (10 / 10 min) per IP.
- CORS origins configurable via `CORS_ORIGINS` (credentials off; JWT uses header).
- Startup warnings if SECRET_KEY / ADMIN_PASSWORD are still default; cannot change password to `admin123`.
- Input validation: max lengths, trimmed text, blood group must be A+/A-/B+/B-/AB+/AB-/O+/O-.
- CSV export neutralises spreadsheet-formula injection.
- `admin.html` marked `noindex`.

## New features
- Public "Become a Blood Donor / Volunteer" form on contact page (`/api/register/donor|volunteer`); camp "Register Now" links there.
- Inline success/error messages instead of `alert()`, buttons disabled while sending.
- Admin: search + blood-group filter + Export CSV for donors & volunteers; Past/Upcoming badge on camps; dashboard shows upcoming/total camps.
- SEO: meta description, Open Graph tags, favicon.

## Before going live
1. Edit `config.js` -> your real API URL.
2. `.env`: strong `SECRET_KEY`, new `ADMIN_PASSWORD`, `CORS_ORIGINS=https://yourdomain`.
3. Replace placeholder timeline / stats text from Admin > Site Settings.

## Round 2: redesign + camps fix
- New public design (`style.css`): navy + crimson palette, Poppins, glass sticky navbar, animated hero drop, count-up stats, scroll-reveal animations, hover effects, mobile hamburger menu, reduced-motion support.
- Old stylesheet kept for the admin panel as `admin.css` (admin.html links to it).
- Camps on home page: shows upcoming camps; if none are upcoming it shows the latest camps marked "Completed" (section is never empty). Fade-in no longer can leave content invisible.
- Gallery items also animate in.
- Admin panel redesigned (`admin.css`): dark navy sidebar, stat cards, clean tables, modern forms/buttons, animated views, toast messages, responsive (sidebar becomes a top bar on mobile). No logic changes.

## Round 3: clean URLs, same tab
- Pages now open at `/`, `/story`, `/contact`, `/admin` (no `.html`); old `.html` URLs redirect.
- The backend serves the website (only whitelisted files: pages + css/js, never `.env`), so one command and one port (8000) runs everything. `config.js` uses the same address automatically.
- All internal links explicitly open in the same tab; admin "View Website" no longer opens a new tab.
- Links also work on plain static servers (Live Server / `python -m http.server` / file://): `config.js` points them to the `.html` files there. Via the backend (port 8000) URLs stay clean.
