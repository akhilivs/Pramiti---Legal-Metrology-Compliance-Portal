from sqlalchemy import create_engine, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker

from config import DATABASE_URL

connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}
engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db():
    """Create missing tables, then add any columns added to the models since the DB was created.

    A tiny forward-only migration so existing inspection data survives upgrades.
    """
    Base.metadata.create_all(bind=engine)
    insp = inspect(engine)
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            existing = {c["name"] for c in insp.get_columns(table.name)}
            for col in table.columns:
                if col.name not in existing:
                    ddl = col.type.compile(dialect=engine.dialect)
                    conn.execute(text(f'ALTER TABLE {table.name} ADD COLUMN "{col.name}" {ddl}'))
        # Back-fill values for scans recorded before these columns existed
        conn.execute(text("UPDATE scans SET source = 'label' WHERE source IS NULL"))
        conn.execute(text("UPDATE scans SET review_status = 'pending' WHERE review_status IS NULL"))
        conn.execute(text("UPDATE scans SET ai_verdict = verdict WHERE ai_verdict IS NULL"))
        conn.execute(text("UPDATE scans SET is_demo = 0 WHERE is_demo IS NULL"))
        conn.execute(text("UPDATE scans SET manufacturer_key = lower(trim(brand)) "
                          "WHERE manufacturer_key IS NULL AND brand IS NOT NULL"))
