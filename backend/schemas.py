from datetime import date, datetime
from typing import Literal, Optional
from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

BloodGroup = Literal["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]


class _Clean(BaseModel):
    """Trims whitespace on every string field."""
    model_config = ConfigDict(str_strip_whitespace=True)


class Token(BaseModel):
    access_token: str
    token_type: str

class LoginRequest(BaseModel):
    username: str
    password: str

class CampCreate(_Clean):
    title: str = Field(min_length=1, max_length=200)
    camp_date: date
    location: str = Field(min_length=1, max_length=255)
    description: Optional[str] = Field(default=None, max_length=5000)
    image: Optional[str] = Field(default=None, max_length=500)

class CampResponse(CampCreate):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class ContactCreate(_Clean):
    name: str = Field(min_length=1, max_length=150)
    email: EmailStr
    phone: Optional[str] = Field(default=None, max_length=30)
    subject: Optional[str] = Field(default=None, max_length=100)
    message: str = Field(min_length=1, max_length=5000)

    @field_validator("subject")
    @classmethod
    def _no_placeholder(cls, v):
        # the form's "Select Subject" placeholder should not be stored
        return None if v in (None, "", "Select Subject") else v

class ContactResponse(ContactCreate):
    id: int
    is_read: bool
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class DonorCreate(_Clean):
    name: str = Field(min_length=1, max_length=150)
    phone: str = Field(min_length=7, max_length=30)
    blood_group: BloodGroup
    email: Optional[EmailStr] = None

    @field_validator("email", mode="before")
    @classmethod
    def _empty_email(cls, v):
        return None if v == "" else v

class DonorResponse(DonorCreate):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class VolunteerCreate(_Clean):
    name: str = Field(min_length=1, max_length=150)
    phone: str = Field(min_length=7, max_length=30)
    email: Optional[EmailStr] = None

    @field_validator("email", mode="before")
    @classmethod
    def _empty_email(cls, v):
        return None if v == "" else v

class VolunteerResponse(VolunteerCreate):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class GalleryCreate(_Clean):
    image: str = Field(min_length=1, max_length=500)
    caption: Optional[str] = Field(default=None, max_length=255)

class GalleryResponse(GalleryCreate):
    id: int
    created_at: datetime
    model_config = ConfigDict(from_attributes=True)

class PasswordChange(BaseModel):
    current_password: str
    new_password: str
