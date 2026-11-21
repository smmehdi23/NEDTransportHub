from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import require_rider
from app.core.time import utcnow
from app.models.ride import PollStatus, PollVote, Ride, RidePoll, RideStatus
from app.models.user import User
from app.schemas.common import MessageResponse
from app.schemas.ride import PollCreate, PollPage, PollRead, RideMatchRead
from app.services.matching import match_ride
from app.services.notifications import notify
from app.routers.rides import ride_to_read

router = APIRouter(prefix="/polls", tags=["Ride Polls"])


def _read(db: Session, poll: RidePoll, user: User) -> PollRead:
    votes = db.scalar(select(func.count(PollVote.id)).where(PollVote.poll_id == poll.id))
    voted = db.scalar(select(PollVote.id).where(PollVote.poll_id == poll.id, PollVote.user_id == user.id)) is not None
    return PollRead(
        id=poll.id, creator_id=poll.creator_id, creator_name=poll.creator.name,
        origin_name=poll.origin_name, destination_name=poll.destination_name,
        origin_lat=poll.origin_lat, origin_lng=poll.origin_lng, dest_lat=poll.dest_lat, dest_lng=poll.dest_lng,
        departure_time=poll.departure_time, seats_needed=poll.seats_needed, note=poll.note, status=poll.status,
        vote_count=votes, has_voted=voted, created_at=poll.created_at,
    )


def _get(db: Session, poll_id: int) -> RidePoll:
    poll = db.get(RidePoll, poll_id)
    if poll is None:
        raise HTTPException(404, "Poll not found.")
    return poll


@router.post("", response_model=PollRead, status_code=201)
def create_poll(payload: PollCreate, user: User = Depends(require_rider), db: Session = Depends(get_db)):
    """Ask for a ride ('I need to go X -> Y at time T'). Others vote; drivers can offer a ride for it."""
    poll = RidePoll(creator_id=user.id, **payload.model_dump())
    db.add(poll)
    db.flush()
    db.add(PollVote(poll_id=poll.id, user_id=user.id))  # the creator counts as the first vote
    db.commit()
    return _read(db, poll, user)


@router.get("", response_model=PollPage)
def list_polls(
    origin: str | None = Query(None, max_length=100), destination: str | None = Query(None, max_length=100),
    mine: bool = False, sort: str = Query("votes", pattern="^(votes|time|new)$"),
    page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=100),
    user: User = Depends(require_rider), db: Session = Depends(get_db),
):
    votes = select(PollVote.poll_id, func.count(PollVote.id).label("n")).group_by(PollVote.poll_id).subquery()
    q = select(RidePoll).outerjoin(votes, votes.c.poll_id == RidePoll.id)
    q = q.where(RidePoll.creator_id == user.id) if mine else q.where(RidePoll.status == PollStatus.OPEN, RidePoll.departure_time > utcnow())
    if origin:
        q = q.where(RidePoll.origin_name.ilike(f"%{origin.strip()}%"))
    if destination:
        q = q.where(RidePoll.destination_name.ilike(f"%{destination.strip()}%"))
    order = {"votes": func.coalesce(votes.c.n, 0).desc(), "time": RidePoll.departure_time.asc(), "new": RidePoll.id.desc()}[sort]
    total = db.scalar(select(func.count()).select_from(q.subquery()))
    rows = db.scalars(q.order_by(order).offset((page - 1) * page_size).limit(page_size)).all()
    return PollPage(items=[_read(db, p, user) for p in rows], total=total, page=page, page_size=page_size)


@router.get("/{poll_id}", response_model=PollRead)
def get_poll(poll_id: int, user: User = Depends(require_rider), db: Session = Depends(get_db)):
    return _read(db, _get(db, poll_id), user)


@router.post("/{poll_id}/vote", response_model=PollRead)
def vote(poll_id: int, user: User = Depends(require_rider), db: Session = Depends(get_db)):
    poll = _get(db, poll_id)
    if poll.status != PollStatus.OPEN:
        raise HTTPException(409, "This poll is closed.")
    db.add(PollVote(poll_id=poll.id, user_id=user.id))
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(409, "You have already voted on this poll.")
    return _read(db, poll, user)


@router.delete("/{poll_id}/vote", response_model=PollRead)
def remove_vote(poll_id: int, user: User = Depends(require_rider), db: Session = Depends(get_db)):
    poll = _get(db, poll_id)
    v = db.scalar(select(PollVote).where(PollVote.poll_id == poll.id, PollVote.user_id == user.id))
    if v is None:
        raise HTTPException(404, "You have not voted on this poll.")
    db.delete(v)
    db.commit()
    return _read(db, poll, user)


@router.post("/{poll_id}/close", response_model=MessageResponse)
def close_poll(poll_id: int, user: User = Depends(require_rider), db: Session = Depends(get_db)):
    poll = _get(db, poll_id)
    if poll.creator_id != user.id:
        raise HTTPException(403, "Only the poll creator can close it.")
    if poll.status != PollStatus.OPEN:
        raise HTTPException(409, "This poll is already closed.")
    poll.status = PollStatus.CLOSED
    db.commit()
    return MessageResponse(message="Poll closed.")


@router.get("/{poll_id}/matches", response_model=list[RideMatchRead])
def poll_matches(poll_id: int, user: User = Depends(require_rider), db: Session = Depends(get_db)):
    """Existing rides that already satisfy this poll (route corridor + time window)."""
    poll = _get(db, poll_id)
    rides = db.scalars(select(Ride).where(Ride.status == RideStatus.OPEN, Ride.available_seats >= poll.seats_needed, Ride.departure_time > utcnow()).limit(500))
    out = []
    for r in rides:
        m = match_ride(r, (poll.origin_lat, poll.origin_lng), (poll.dest_lat, poll.dest_lng), poll.departure_time)
        if m:
            out.append(RideMatchRead(ride=ride_to_read(db, r, user), pickup_distance_m=round(m.pickup_distance_m, 1),
                                     dropoff_distance_m=round(m.dropoff_distance_m or 0, 1),
                                     time_diff_min=round(m.time_diff_min, 1), score=m.score))
    return sorted(out, key=lambda x: -x.score)
