from datetime import datetime, timezone
from sqlalchemy import Boolean, Column, Date, DateTime, Integer, String, Text
from database import Base

class Admin(Base):
    __tablename__ = "admins"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

class Camp(Base):
    __tablename__ = "camps"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(200), nullable=False)
    camp_date = Column(Date, nullable=False)
    location = Column(String(255), nullable=False)
    description = Column(Text)
    image = Column(String(500))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

class ContactMessage(Base):
    __tablename__ = "contact_messages"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    email = Column(String(255), nullable=False)
    phone = Column(String(30))
    subject = Column(String(100))
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

class Donor(Base):
    __tablename__ = "donors"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    phone = Column(String(30), nullable=False)
    blood_group = Column(String(10), nullable=False)
    email = Column(String(255))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

class Volunteer(Base):
    __tablename__ = "volunteers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(150), nullable=False)
    phone = Column(String(30), nullable=False)
    email = Column(String(255))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))

class SiteSetting(Base):
    """Key/value store for editable website content (phone, email, QR, hero text...)."""
    __tablename__ = "site_settings"
    key = Column(String(100), primary_key=True)
    value = Column(Text, nullable=False, default="")

class GalleryImage(Base):
    __tablename__ = "gallery_images"
    id = Column(Integer, primary_key=True, index=True)
    image = Column(String(500), nullable=False)
    caption = Column(String(255))
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc).replace(tzinfo=None))
