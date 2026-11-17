from datetime import date
from database import Base, engine, SessionLocal
from models import Camp

Base.metadata.create_all(bind=engine)
db = SessionLocal()

if db.query(Camp).count() == 0:
    db.add_all([
        Camp(title="Community Blood Camp", camp_date=date(2026,10,5), location="Asansol, West Bengal", description="Community blood donation camp."),
        Camp(title="Save A Life Drive", camp_date=date(2026,10,12), location="Kolkata, West Bengal", description="Blood donation awareness drive."),
        Camp(title="Youth Blood Donation", camp_date=date(2026,10,20), location="Durgapur, West Bengal", description="Youth-focused blood donation camp."),
        Camp(title="Hope For Humanity", camp_date=date(2026,10,27), location="Bardhaman, West Bengal", description="Community blood donation camp."),
    ])
    db.commit()
    print("Sample camps inserted.")
else:
    print("Camps already exist.")
db.close()
