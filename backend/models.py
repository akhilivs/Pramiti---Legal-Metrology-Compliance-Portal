import datetime

from sqlalchemy import JSON, Boolean, Column, DateTime, Float, ForeignKey, Integer, String, Text

from database import Base


def utcnow():
    return datetime.datetime.now(datetime.timezone.utc).replace(tzinfo=None)


ROLES = ("inspector", "controller", "admin")  # each role includes the powers of the ones before it


class User(Base):
    __tablename__ = "users"
    __table_args__ = {"sqlite_autoincrement": True}

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, index=True)
    name = Column(String)
    designation = Column(String, nullable=True)
    role = Column(String, default="inspector")
    password_hash = Column(String)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=utcnow)


class Scan(Base):
    """One inspection: a product label (photos) or an e-commerce listing."""

    __tablename__ = "scans"
    # Never reuse IDs of deleted scans - they appear in printed reference numbers
    __table_args__ = {"sqlite_autoincrement": True}

    id = Column(Integer, primary_key=True, index=True)
    created_at = Column(DateTime, default=utcnow, index=True)
    inspector = Column(String, nullable=True)  # email of the officer, or "public" for complaints

    source = Column(String, default="label", index=True)  # label | ecommerce | complaint
    source_url = Column(String, nullable=True)
    batch_id = Column(Integer, nullable=True, index=True)
    is_demo = Column(Boolean, default=False, index=True)

    # Images
    original_filename = Column(String)
    image_file = Column(String, nullable=True)  # primary photo, name inside uploads/
    images = Column(JSON, default=list)  # all photos (primary first)

    # Inspection context entered by the officer (all optional)
    location = Column(String, nullable=True)
    state = Column(String, nullable=True, index=True)  # two-letter code, see rules_kb.STATES
    district = Column(String, nullable=True)
    measured_quantity = Column(String, nullable=True)
    notes = Column(Text, nullable=True)

    # Analysis
    product_name = Column(String, nullable=True, index=True)
    brand = Column(String, nullable=True, index=True)
    manufacturer_name = Column(String, nullable=True)
    manufacturer_key = Column(String, nullable=True, index=True)  # normalised, for repeat-offender grouping
    category = Column(String, nullable=True)
    verdict = Column(String, index=True)  # compliant | non_compliant | needs_review (after officer review)
    ai_verdict = Column(String, nullable=True)  # what the AI alone concluded
    score = Column(Float)
    summary = Column(Text, nullable=True)
    summary_hi = Column(Text, nullable=True)
    raw_text = Column(Text, nullable=True)
    fields = Column(JSON, default=dict)
    checks = Column(JSON, default=list)  # each: id, rule, title, status, evidence, recommendation, officer_status, officer_note
    regions = Column(JSON, default=list)  # bounding boxes of declarations on the photos
    model = Column(String, nullable=True)

    # Officer review
    review_status = Column(String, default="pending", index=True)  # pending | reviewed
    reviewed_by = Column(String, nullable=True)
    reviewed_at = Column(DateTime, nullable=True)


class Notice(Base):
    """Show-cause notice raised from a non-compliant inspection."""

    __tablename__ = "notices"
    __table_args__ = {"sqlite_autoincrement": True}

    id = Column(Integer, primary_key=True)
    number = Column(String, nullable=True, index=True)  # allotted when issued
    scan_id = Column(Integer, ForeignKey("scans.id"), index=True)
    status = Column(String, default="draft", index=True)  # draft | approved | issued | replied | closed
    addressee = Column(Text)
    violations = Column(JSON, default=list)  # [{id, rule, title, evidence}]
    sections = Column(JSON, default=list)  # penalty provisions cited
    reply_days = Column(Integer, default=15)
    remarks = Column(Text, nullable=True)
    reply_text = Column(Text, nullable=True)
    outcome = Column(Text, nullable=True)
    is_demo = Column(Boolean, default=False)

    created_by = Column(String)
    created_at = Column(DateTime, default=utcnow)
    approved_by = Column(String, nullable=True)
    approved_at = Column(DateTime, nullable=True)
    issued_at = Column(DateTime, nullable=True)
    reply_due = Column(DateTime, nullable=True)
    closed_at = Column(DateTime, nullable=True)


class Complaint(Base):
    """Consumer complaint submitted through the public portal."""

    __tablename__ = "complaints"
    __table_args__ = {"sqlite_autoincrement": True}

    id = Column(Integer, primary_key=True)
    code = Column(String, unique=True, index=True)  # tracking code given to the citizen
    scan_id = Column(Integer, ForeignKey("scans.id"), nullable=True)
    name = Column(String, nullable=True)
    contact = Column(String, nullable=True)
    state = Column(String, nullable=True, index=True)
    place = Column(String, nullable=True)
    purchased_online = Column(Boolean, default=False)
    description = Column(Text, nullable=True)
    status = Column(String, default="received", index=True)  # received | under_review | action_taken | closed
    officer_note = Column(Text, nullable=True)
    assigned_to = Column(String, nullable=True)
    is_demo = Column(Boolean, default=False)
    created_at = Column(DateTime, default=utcnow, index=True)
    updated_at = Column(DateTime, default=utcnow)


class Batch(Base):
    __tablename__ = "batches"
    __table_args__ = {"sqlite_autoincrement": True}

    id = Column(Integer, primary_key=True)
    name = Column(String)
    created_by = Column(String)
    created_at = Column(DateTime, default=utcnow)
    status = Column(String, default="queued")  # queued | running | done
    state = Column(String, nullable=True)
    location = Column(String, nullable=True)


class BatchItem(Base):
    __tablename__ = "batch_items"
    __table_args__ = {"sqlite_autoincrement": True}

    id = Column(Integer, primary_key=True)
    batch_id = Column(Integer, ForeignKey("batches.id"), index=True)
    kind = Column(String)  # files | url
    label = Column(String)  # filename / folder / URL shown to the officer
    payload = Column(JSON, default=list)  # temp file names, or [url]
    status = Column(String, default="queued")  # queued | running | done | failed
    scan_id = Column(Integer, nullable=True)
    error = Column(Text, nullable=True)


class AuditLog(Base):
    __tablename__ = "audit_log"
    __table_args__ = {"sqlite_autoincrement": True}

    id = Column(Integer, primary_key=True)
    at = Column(DateTime, default=utcnow, index=True)
    actor = Column(String, index=True)
    action = Column(String, index=True)
    target = Column(String, nullable=True)
    details = Column(Text, nullable=True)
