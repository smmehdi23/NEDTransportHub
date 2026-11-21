from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_rider
from app.models.booking import Booking, BookingStatus
from app.models.rating import Rating
from app.models.ride import Ride, RideStatus
from app.models.user import User
from app.schemas.misc import RatingCreate, RatingRead, RatingSummary
from app.services.notifications import notify
from app.services.rides import user_rating

router = APIRouter(prefix="/ratings", tags=["Ratings"])


def _people(db: Session, ride: Ride) -> set[int]:
    """Driver + passengers who actually completed the ride."""
    ids = set(db.scalars(select(Booking.passenger_id).where(Booking.ride_id == ride.id, Booking.status == BookingStatus.COMPLETED)))
    return ids | {ride.driver_id}


@router.post("", response_model=RatingRead, status_code=201)
def rate(payload: RatingCreate, user: User = Depends(require_rider), db: Session = Depends(get_db)):
    """Rate a co-rider/driver after a completed ride. One rating per (ride, rater, rated)."""
    ride = db.get(Ride, payload.ride_id)
    if ride is None:
        raise HTTPException(404, "Ride not found.")
    if ride.status != RideStatus.COMPLETED:
        raise HTTPException(409, "You can only rate after the ride is completed.")
    people = _people(db, ride)
    if user.id not in people:
        raise HTTPException(403, "You did not take part in this ride.")
    if payload.rated_user_id == user.id:
        raise HTTPException(422, "You cannot rate yourself.")
    if payload.rated_user_id not in people:
        raise HTTPException(422, "That user did not take part in this ride.")
    r = Rating(ride_id=ride.id, rater_id=user.id, rated_user_id=payload.rated_user_id, score=payload.score,
               review=payload.review.strip() if payload.review else None)
    db.add(r)
    try:
        db.flush()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "You have already rated this person for this ride.")
    notify(db, payload.rated_user_id, "rating_received", "New rating", f"{user.name} rated you {payload.score}/5.", {"ride_id": ride.id})
    db.commit()
    return r


@router.get("/rides/{ride_id}/pending")
def pending(ride_id: int, user: User = Depends(require_rider), db: Session = Depends(get_db)):
    """People on this ride I have not rated yet."""
    ride = db.get(Ride, ride_id)
    if ride is None or ride.status != RideStatus.COMPLETED or user.id not in _people(db, ride):
        raise HTTPException(404, "Ride not found.")
    done = set(db.scalars(select(Rating.rated_user_id).where(Rating.ride_id == ride_id, Rating.rater_id == user.id)))
    todo = _people(db, ride) - done - {user.id}
    return [{"user_id": u.id, "name": u.name} for u in db.scalars(select(User).where(User.id.in_(todo)))] if todo else []


@router.get("/users/{user_id}", response_model=RatingSummary)
def summary(user_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if db.get(User, user_id) is None:
        raise HTTPException(404, "User not found.")
    avg, count = user_rating(db, user_id)
    recent = db.scalars(select(Rating).where(Rating.rated_user_id == user_id).order_by(Rating.id.desc()).limit(10)).all()
    return RatingSummary(user_id=user_id, average=avg, count=count, recent=[RatingRead.model_validate(r) for r in recent])
