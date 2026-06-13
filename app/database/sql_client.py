import datetime
from sqlalchemy import create_engine, Column, String, DateTime
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings
from app.logger import setup_logger

logger = setup_logger("database.sql_client")

# 1. Setup SQLite Engine (saves to your local data folder)
db_path = settings.DATA_DIR / "nexusmind.db"
engine = create_engine(f"sqlite:///{db_path}", connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

# 2. Define the Bot Configuration Table
class BotConfig(Base):
    __tablename__ = "bots"
    
    id = Column(String, primary_key=True, index=True)
    name = Column(String, index=True)
    system_prompt = Column(String)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

# 3. Database Initialization
def init_db():
    """Creates the tables if they don't exist."""
    Base.metadata.create_all(bind=engine)
    logger.info("SQLite database and BotConfig tables initialized.")

# 4. CRUD Helper Functions
def get_bot(bot_id: str):
    """Fetches a bot's configuration by its ID."""
    db = SessionLocal()
    try:
        bot = db.query(BotConfig).filter(BotConfig.id == bot_id).first()
        return bot
    finally:
        db.close()

def create_or_update_bot(bot_id: str, name: str, system_prompt: str):
    """Creates a new bot or updates an existing one."""
    db = SessionLocal()
    try:
        bot = BotConfig(id=bot_id, name=name, system_prompt=system_prompt)
        db.merge(bot)  # Merge automatically inserts or updates based on the primary key
        db.commit()
        return bot
    except Exception as e:
        db.rollback()
        logger.error(f"Failed to save bot config: {str(e)}")
        raise
    finally:
        db.close()