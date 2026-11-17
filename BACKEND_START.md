# LifeDrop - Quick Start (one command, one port)

The backend now serves the website too.

1. `cd backend`
2. `python3 -m venv venv && source venv/bin/activate`
3. `pip install -r requirements.txt`
4. `cp .env.example .env`  (set SECRET_KEY / ADMIN_PASSWORD)
5. `uvicorn main:app --reload`
6. First time only (new terminal, venv active): `curl -X POST http://127.0.0.1:8000/api/admin/setup` and `python seed.py`

Open:
- Website: http://127.0.0.1:8000/
- Our Story: http://127.0.0.1:8000/story
- Contact: http://127.0.0.1:8000/contact
- Admin: http://127.0.0.1:8000/admin
- API docs: http://127.0.0.1:8000/docs

No Live Server / second server needed. Old `/story.html`-style URLs redirect to the clean ones.
