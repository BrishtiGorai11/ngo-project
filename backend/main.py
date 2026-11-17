import logging
import os
import time
import uuid
from collections import defaultdict, deque
from datetime import date
from pathlib import Path
from fastapi import Depends, FastAPI, File, HTTPException, Query, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from sqlalchemy import func
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from database import Base, engine, get_db
from models import (Admin, Camp, ContactMessage, Donor, GalleryImage,
                    SiteSetting, Volunteer)
from schemas import (CampCreate, CampResponse, ContactCreate, ContactResponse,
                     DonorCreate, DonorResponse, GalleryCreate, GalleryResponse,
                     LoginRequest, PasswordChange, Token, VolunteerCreate,
                     VolunteerResponse)
from site_defaults import SITE_DEFAULTS
from auth import create_access_token, get_current_admin, hash_password, verify_password

load_dotenv()
app = FastAPI(title="LifeDrop NGO API", version="1.0.0")

log = logging.getLogger("lifedrop")

_origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "*").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    # credentials are not used (JWT goes in the Authorization header), and
    # "*" together with credentials is not allowed by browsers anyway
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

if os.getenv("SECRET_KEY", "change-me").startswith("change"):
    log.warning("SECRET_KEY is still the default value - set a long random one in .env")
if os.getenv("ADMIN_PASSWORD", "admin123") == "admin123":
    log.warning("ADMIN_PASSWORD is the default - change it from Admin > Account after first login")


# ---------- tiny in-memory rate limiter (per IP) ----------
_hits = defaultdict(deque)

def rate_limit(bucket: str, limit: int, per_seconds: int):
    """FastAPI dependency: allow `limit` requests per `per_seconds` from one IP."""
    def checker(request: Request):
        ip = request.client.host if request.client else "unknown"
        q = _hits[(bucket, ip)]
        now = time.monotonic()
        while q and now - q[0] > per_seconds:
            q.popleft()
        if len(q) >= limit:
            raise HTTPException(status_code=429, detail="Too many requests. Please try again in a few minutes.")
        q.append(now)
    return checker

limit_login = rate_limit("login", 8, 300)
limit_public_form = rate_limit("form", 10, 600)

Base.metadata.create_all(bind=engine)

# ---------- uploads (camp photos, gallery, payment QR) ----------
UPLOAD_DIR = Path(__file__).resolve().parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

ALLOWED_EXT = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_UPLOAD_BYTES = 5 * 1024 * 1024  # 5 MB


def _looks_like_image(data: bytes) -> bool:
    return (data.startswith(b"\xff\xd8\xff")                       # jpeg
            or data.startswith(b"\x89PNG\r\n\x1a\n")                 # png
            or data.startswith((b"GIF87a", b"GIF89a"))               # gif
            or (data[:4] == b"RIFF" and data[8:12] == b"WEBP"))      # webp


def _remove_upload(url):
    """Delete an uploaded file from disk (only files inside /uploads)."""
    if not url or not url.startswith("/uploads/"):
        return
    path = UPLOAD_DIR / Path(url).name
    try:
        path.unlink(missing_ok=True)
    except OSError:
        pass

# ---------- website pages (clean URLs: /  /story  /contact  /admin) ----------
FRONT_DIR = Path(__file__).resolve().parent.parent
PAGES = {"/": "index.html", "/story": "story.html", "/contact": "contact.html", "/admin": "admin.html"}
ASSETS = ["style.css", "admin.css", "script.js", "admin.js", "config.js"]   # only these files are public


def _page(filename):
    def handler():
        return FileResponse(FRONT_DIR / filename, headers={"Cache-Control": "no-cache"})
    return handler

def _redirect(target):
    def handler():
        return RedirectResponse(target)
    return handler

for _url, _file in PAGES.items():
    app.add_api_route(_url, _page(_file), methods=["GET"], include_in_schema=False)
    app.add_api_route(f"/{_file}", _redirect(_url), methods=["GET"], include_in_schema=False)   # old /story.html -> /story

for _name in ASSETS:
    app.add_api_route(f"/{_name}", _page(_name), methods=["GET"], include_in_schema=False)

@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.post("/api/admin/setup")
def setup_admin(db: Session = Depends(get_db)):
    if db.query(Admin).count() > 0:
        return {"message": "Admin already exists"}
    username = os.getenv("ADMIN_USERNAME", "admin")
    password = os.getenv("ADMIN_PASSWORD", "admin123")
    db.add(Admin(username=username, password_hash=hash_password(password)))
    db.commit()
    return {"message": "Initial admin created", "username": username}

@app.post("/api/admin/login", response_model=Token)
def admin_login(data: LoginRequest, db: Session = Depends(get_db),
                _: None = Depends(limit_login)):
    admin = db.query(Admin).filter(Admin.username == data.username).first()
    if not admin or not verify_password(data.password, admin.password_hash):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    return {"access_token": create_access_token(admin.username), "token_type": "bearer"}

@app.get("/api/camps", response_model=list[CampResponse])
def get_camps(upcoming: bool = Query(False, description="only camps from today onwards"),
              db: Session = Depends(get_db)):
    q = db.query(Camp)
    if upcoming:
        q = q.filter(Camp.camp_date >= date.today())
    return q.order_by(Camp.camp_date.asc()).all()

@app.post("/api/camps", response_model=CampResponse)
def create_camp(data: CampCreate, db: Session = Depends(get_db),
                _: Admin = Depends(get_current_admin)):
    camp = Camp(**data.model_dump())
    db.add(camp)
    db.commit()
    db.refresh(camp)
    return camp

@app.put("/api/camps/{camp_id}", response_model=CampResponse)
def update_camp(camp_id: int, data: CampCreate, db: Session = Depends(get_db),
                _: Admin = Depends(get_current_admin)):
    camp = db.query(Camp).filter(Camp.id == camp_id).first()
    if not camp:
        raise HTTPException(status_code=404, detail="Camp not found")
    old_image = camp.image
    for key, value in data.model_dump().items():
        setattr(camp, key, value)
    db.commit()
    db.refresh(camp)
    if old_image and old_image != camp.image:
        _remove_upload(old_image)
    return camp

@app.delete("/api/camps/{camp_id}")
def delete_camp(camp_id: int, db: Session = Depends(get_db),
                _: Admin = Depends(get_current_admin)):
    camp = db.query(Camp).filter(Camp.id == camp_id).first()
    if not camp:
        raise HTTPException(status_code=404, detail="Camp not found")
    image = camp.image
    db.delete(camp)
    db.commit()
    _remove_upload(image)
    return {"message": "Camp deleted successfully"}

@app.post("/api/contact", response_model=ContactResponse)
def create_contact(data: ContactCreate, db: Session = Depends(get_db),
                   _: None = Depends(limit_public_form)):
    contact = ContactMessage(**data.model_dump())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    return contact

@app.get("/api/messages", response_model=list[ContactResponse])
def get_messages(db: Session = Depends(get_db),
                 _: Admin = Depends(get_current_admin)):
    return db.query(ContactMessage).order_by(ContactMessage.created_at.desc()).all()

@app.patch("/api/messages/{message_id}/read")
def mark_message_read(message_id: int, db: Session = Depends(get_db),
                       _: Admin = Depends(get_current_admin)):
    message = db.query(ContactMessage).filter(ContactMessage.id == message_id).first()
    if not message:
        raise HTTPException(status_code=404, detail="Message not found")
    message.is_read = True
    db.commit()
    return {"message": "Message marked as read"}

@app.get("/api/donors", response_model=list[DonorResponse])
def get_donors(db: Session = Depends(get_db),
               _: Admin = Depends(get_current_admin)):
    return db.query(Donor).order_by(Donor.created_at.desc()).all()

@app.post("/api/donors", response_model=DonorResponse)
def create_donor(data: DonorCreate, db: Session = Depends(get_db),
                 _: Admin = Depends(get_current_admin)):
    donor = Donor(**data.model_dump())
    db.add(donor)
    db.commit()
    db.refresh(donor)
    return donor

@app.get("/api/volunteers", response_model=list[VolunteerResponse])
def get_volunteers(db: Session = Depends(get_db),
                   _: Admin = Depends(get_current_admin)):
    return db.query(Volunteer).order_by(Volunteer.created_at.desc()).all()

@app.post("/api/volunteers", response_model=VolunteerResponse)
def create_volunteer(data: VolunteerCreate, db: Session = Depends(get_db),
                     _: Admin = Depends(get_current_admin)):
    volunteer = Volunteer(**data.model_dump())
    db.add(volunteer)
    db.commit()
    db.refresh(volunteer)
    return volunteer


# ---- public sign-up forms (no login needed, rate limited) ----
@app.post("/api/register/donor")
def register_donor(data: DonorCreate, db: Session = Depends(get_db),
                   _: None = Depends(limit_public_form)):
    db.add(Donor(**data.model_dump()))
    db.commit()
    return {"message": "Thank you for registering as a donor!"}

@app.post("/api/register/volunteer")
def register_volunteer(data: VolunteerCreate, db: Session = Depends(get_db),
                       _: None = Depends(limit_public_form)):
    db.add(Volunteer(**data.model_dump()))
    db.commit()
    return {"message": "Thank you for volunteering!"}

@app.get("/api/dashboard/stats")
def dashboard_stats(db: Session = Depends(get_db),
                    _: Admin = Depends(get_current_admin)):
    return {
        "donors": db.query(func.count(Donor.id)).scalar() or 0,
        "camps": db.query(func.count(Camp.id)).scalar() or 0,
        "upcoming_camps": db.query(func.count(Camp.id)).filter(
            Camp.camp_date >= date.today()).scalar() or 0,
        "volunteers": db.query(func.count(Volunteer.id)).scalar() or 0,
        "messages": db.query(func.count(ContactMessage.id)).filter(
            ContactMessage.is_read == False
        ).scalar() or 0,
    }


# ======================= ADMIN PANEL: extra features =======================

@app.post("/api/admin/change-password")
def change_password(data: PasswordChange, db: Session = Depends(get_db),
                    admin: Admin = Depends(get_current_admin)):
    if not verify_password(data.current_password, admin.password_hash):
        raise HTTPException(status_code=400, detail="Current password is wrong")
    if len(data.new_password) < 8:
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters")
    if data.new_password == "admin123":
        raise HTTPException(status_code=400, detail="Please choose a different password")
    admin.password_hash = hash_password(data.new_password)
    db.commit()
    return {"message": "Password changed successfully"}


# ---- image upload ----
@app.post("/api/upload")
async def upload_image(file: UploadFile = File(...),
                       _: Admin = Depends(get_current_admin)):
    ext = Path(file.filename or "").suffix.lower()
    if ext not in ALLOWED_EXT:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, WEBP or GIF images are allowed")
    data = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image is too large (max 5 MB)")
    if not _looks_like_image(data):
        raise HTTPException(status_code=400, detail="File is not a valid image")
    name = f"{uuid.uuid4().hex}{ext}"
    (UPLOAD_DIR / name).write_bytes(data)
    return {"url": f"/uploads/{name}"}


# ---- website settings (contact info, QR, hero text, stats ...) ----
def _load_settings(db: Session) -> dict:
    values = dict(SITE_DEFAULTS)
    for row in db.query(SiteSetting).all():
        if row.key in SITE_DEFAULTS:
            values[row.key] = row.value
    return values


@app.get("/api/settings")
def get_settings(db: Session = Depends(get_db)):
    return _load_settings(db)


@app.put("/api/settings")
def update_settings(data: dict[str, str], db: Session = Depends(get_db),
                    _: Admin = Depends(get_current_admin)):
    unknown = [k for k in data if k not in SITE_DEFAULTS]
    if unknown:
        raise HTTPException(status_code=400, detail=f"Unknown setting(s): {', '.join(unknown)}")
    old_qr = _load_settings(db).get("qr_image")
    for key, value in data.items():
        value = value.strip()[:5000]
        row = db.query(SiteSetting).filter(SiteSetting.key == key).first()
        if row:
            row.value = value
        else:
            db.add(SiteSetting(key=key, value=value))
    db.commit()
    new_qr = data.get("qr_image")
    if new_qr is not None and old_qr and old_qr != new_qr.strip():
        _remove_upload(old_qr)
    return _load_settings(db)


# ---- gallery ----
@app.get("/api/gallery", response_model=list[GalleryResponse])
def get_gallery(db: Session = Depends(get_db)):
    return db.query(GalleryImage).order_by(GalleryImage.created_at.desc()).all()


@app.post("/api/gallery", response_model=GalleryResponse)
def add_gallery_image(data: GalleryCreate, db: Session = Depends(get_db),
                      _: Admin = Depends(get_current_admin)):
    item = GalleryImage(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@app.delete("/api/gallery/{item_id}")
def delete_gallery_image(item_id: int, db: Session = Depends(get_db),
                         _: Admin = Depends(get_current_admin)):
    item = db.query(GalleryImage).filter(GalleryImage.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Image not found")
    image = item.image
    db.delete(item)
    db.commit()
    _remove_upload(image)
    return {"message": "Image deleted"}


# ---- delete messages / donors / volunteers ----
def _delete_row(db: Session, model, row_id: int, label: str):
    row = db.query(model).filter(model.id == row_id).first()
    if not row:
        raise HTTPException(status_code=404, detail=f"{label} not found")
    db.delete(row)
    db.commit()
    return {"message": f"{label} deleted"}


@app.delete("/api/messages/{message_id}")
def delete_message(message_id: int, db: Session = Depends(get_db),
                   _: Admin = Depends(get_current_admin)):
    return _delete_row(db, ContactMessage, message_id, "Message")


@app.delete("/api/donors/{donor_id}")
def delete_donor(donor_id: int, db: Session = Depends(get_db),
                 _: Admin = Depends(get_current_admin)):
    return _delete_row(db, Donor, donor_id, "Donor")


@app.delete("/api/volunteers/{volunteer_id}")
def delete_volunteer(volunteer_id: int, db: Session = Depends(get_db),
                     _: Admin = Depends(get_current_admin)):
    return _delete_row(db, Volunteer, volunteer_id, "Volunteer")
