import os
from datetime import datetime
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy import String, Integer, DateTime, Text

DATABASE_URL = "sqlite+aiosqlite:///./visuallearn.db"

# Create async engine pointing to SQLite visuallearn.db
engine = create_async_engine(DATABASE_URL, echo=True)

# Create session maker configured for AsyncSession
SessionLocal = async_sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

# Define SQLAlchemy DeclarativeBase
class Base(DeclarativeBase):
    pass

# QuizResult model schema
class QuizResult(Base):
    __tablename__ = "quiz_results"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String, nullable=False)
    topic: Mapped[str] = mapped_column(String, nullable=False)
    score: Mapped[int] = mapped_column(Integer, nullable=False)
    correct_count: Mapped[int] = mapped_column(Integer, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

# WorkspaceCache model schema
class WorkspaceCache(Base):
    __tablename__ = "workspace_cache"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    prompt: Mapped[str] = mapped_column(String, nullable=False, unique=True, index=True)
    topic: Mapped[str] = mapped_column(String, nullable=False)
    subject: Mapped[str] = mapped_column(String, nullable=False)
    grade: Mapped[str] = mapped_column(String, nullable=False)
    video_url: Mapped[str] = mapped_column(String, nullable=False)
    key_points: Mapped[str] = mapped_column(Text, nullable=False)  # JSON text
    quiz_data: Mapped[str] = mapped_column(Text, nullable=False)   # JSON text

# User model schema
class User(Base):
    __tablename__ = "users"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    username: Mapped[str] = mapped_column(String, unique=True, index=True, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=True)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    timestamp: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

# Async database session generator dependency
async def get_db():
    async with SessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()
