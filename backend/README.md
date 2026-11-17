# LifeDrop NGO Backend

## Stack
Python + FastAPI + PostgreSQL + SQLAlchemy + JWT

## PostgreSQL setup

```bash
sudo -u postgres psql
```

```sql
CREATE DATABASE lifedrop_db;
CREATE USER lifedrop_user WITH PASSWORD 'lifedrop_password';
GRANT ALL PRIVILEGES ON DATABASE lifedrop_db TO lifedrop_user;
\c lifedrop_db
GRANT ALL ON SCHEMA public TO lifedrop_user;
ALTER SCHEMA public OWNER TO lifedrop_user;
\q
```

## Python setup

```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env     # then edit SECRET_KEY / ADMIN_PASSWORD / CORS_ORIGINS
uvicorn main:app --reload
```

Create the first admin:

```bash
curl -X POST http://127.0.0.1:8000/api/admin/setup
```

Insert sample camps:

```bash
python seed.py
```

Swagger API docs:

http://127.0.0.1:8000/docs

## Public endpoints
GET /api/camps  (add ?upcoming=true for only future camps)
GET /api/gallery
GET /api/settings
POST /api/contact            (rate limited)
POST /api/register/donor     (rate limited)
POST /api/register/volunteer (rate limited)
GET /api/health

## Admin endpoints
POST /api/admin/login
POST /api/camps
PUT /api/camps/{id}
DELETE /api/camps/{id}
GET /api/messages
PATCH /api/messages/{id}/read
GET /api/donors
POST /api/donors
GET /api/volunteers
POST /api/volunteers
GET /api/dashboard/stats
