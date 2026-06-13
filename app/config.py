import os
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field

class Settings(BaseSettings):
    """
    Core application settings with strict Pydantic type validation.
    Guarantees all environment configurations are valid before runtime execution.
    """
    model_config = SettingsConfigDict(
        env_file=".env", 
        env_file_encoding="utf-8", 
        extra="ignore"
    )

    # --- Project Directory Paths ---
    BASE_DIR: Path = Field(default_factory=lambda: Path(__file__).resolve().parent.parent)
    DATA_DIR: Path = Field(default_factory=lambda: Path(__file__).resolve().parent / "database")
    CHROMA_PERSIST_DIR: Path = Field(default_factory=lambda: Path(__file__).resolve().parent / "database" / "chroma")

    # --- Security & Core API Keys ---
    GROQ_API_KEY: str = Field(..., description="Groq API key required for LLM inference workflows")

    # --- Local Models Configuration ---
    EMBEDDING_MODEL_NAME: str = Field(default="sentence-transformers/all-MiniLM-L6-v2")
    
    # --- Groq LLM Inference Models ---
    REASONING_LLM: str = Field(default="llama-3.3-70b-versatile")
    ROUTING_LLM: str = Field(default="llama-3.1-8b-instant")

    # --- Local Database Endpoints ---
    NEO4J_URI: str = Field(default="bolt://localhost:7687")
    NEO4J_USER: str = Field(default="neo4j")
    NEO4J_PASSWORD: str = Field(default="password")

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        # Automatically verify and provision local persistence directories on initialization
        os.makedirs(self.DATA_DIR, exist_ok=True)
        os.makedirs(self.CHROMA_PERSIST_DIR, exist_ok=True)

# Instantiate a global singleton instance for the application space
settings = Settings()