# Admin Panel Guide

## Start
1. Backend: `cd backend && uvicorn main:app --reload`   (new tables are created automatically)
2. Open http://127.0.0.1:8000/admin and login (default: admin / admin123).
3. **First thing: Account -> Change Password.**

## What you can manage
- Blood Camps: add / edit / delete, with photo upload
- Gallery: upload many photos (shown on home page), delete
- Messages: read, mark as read, reply by email, delete
- Donors / Volunteers: add, delete, search, filter by blood group, export CSV (website visitors can also sign up themselves from the Contact page)
- Site Settings: phone, WhatsApp, email, address, donation QR + UPI ID,
  social links, home hero text, stats, about text, story text, footer tagline
- Account: change password

Uploaded images are stored in `backend/uploads/` (max 5 MB, jpg/png/webp/gif).
