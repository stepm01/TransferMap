from app.db import get_db
from app.models import User
from sqlalchemy.orm import Session

def get_user_dict(user_email: str, db: Session):
    user = db.query(User).filter(User.email == user_email).first()
    if not user:
        return None

    return {
        "name": user.name,
        "community_college": user.community_college,
        "target_uc": user.target_uc or "Not specified",
        "major": user.major
    }
