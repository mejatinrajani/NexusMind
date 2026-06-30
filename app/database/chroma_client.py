import os
import threading
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings as ChromaSettings
from langchain_huggingface import HuggingFaceInferenceAPIEmbeddings
from app.config import settings
from app.logger import setup_logger

logger = setup_logger("database.chroma_client")

class ChromaManager:
    """
    Thread-safe, multi-tenant wrapper around local persistent ChromaDB.
    Manages isolated semantic vector spaces dynamically per chatbot workspace.
    """
    _instance: Optional["ChromaManager"] = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        """Enforces a thread-safe Singleton pattern for database client access."""
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if self._initialized:
            return
            
        try:
            chroma_path = settings.DATA_DIR / "chroma"
            logger.info(f"Initializing persistent local ChromaDB client at: {chroma_path}")
            
            # Instantiate native persistent disk client
            self.client = chromadb.PersistentClient(
                path=str(chroma_path),
                settings=ChromaSettings(anonymized_telemetry=False)
            )
            
            logger.info("Connecting to Hugging Face Serverless Inference API...")
            hf_token = os.environ.get("HUGGINGFACEHUB_API_TOKEN")
            
            if not hf_token:
                logger.warning("HUGGINGFACEHUB_API_TOKEN is missing! Embeddings will fail.")
            
            # Initialize API Embeddings once (Zero RAM usage on Render)
            self.embedding_function = HuggingFaceInferenceAPIEmbeddings(
                api_key=hf_token,
                model_name="sentence-transformers/all-MiniLM-L6-v2"
            )
            
            self._write_lock = threading.Lock()
            self._initialized = True
            logger.info("ChromaManager storage subsystem initialized successfully.")
        except Exception as e:
            logger.critical(f"Failed to initialize ChromaDB vector engine: {str(e)}", exc_info=True)
            raise e

    def _get_clean_collection_name(self, chatbot_id: str) -> str:
        """Normalizes user-provided chatbot names to comply with strict ChromaDB naming constraints."""
        clean_name = "".join(c if c.isalnum() or c in ["-", "_"] else "_" for c in chatbot_id).lower()
        if len(clean_name) < 3:
            clean_name = f"bot_{clean_name}"
        return clean_name[:63]

    def get_or_create_collection(self, chatbot_id: str) -> chromadb.Collection:
        """Retrieves or instantly provisions an isolated collection space for a specific tenant."""
        collection_name = self._get_clean_collection_name(chatbot_id)
        with self._write_lock:
            try:
                logger.info(f"Accessing isolated vector collection space: {collection_name}")
                return self.client.get_or_create_collection(name=collection_name)
            except Exception as e:
                logger.error(f"Failed to provision vector collection namespace '{collection_name}': {str(e)}")
                raise e

    def add_documents(self, chatbot_id: str, texts: List[str], metadatas: List[Dict[str, Any]], ids: List[str]) -> bool:
        """
        Embeds and indexes document chunks securely into a specific chatbot's workspace.
        """
        if not texts:
            return False
            
        collection = self.get_or_create_collection(chatbot_id)
        
        try:
            logger.info(f"Generating semantic embeddings via API for {len(texts)} chunks for chatbot: {chatbot_id}")
            
            # Compute embeddings FIRST using the LangChain wrapper
            embeddings_list = self.embedding_function.embed_documents(texts)
            
            with self._write_lock:
                # Pass the raw list of vectors to Chroma
                collection.add(
                    documents=texts,
                    embeddings=embeddings_list,
                    metadatas=metadatas,
                    ids=ids
                )
            logger.info(f"Successfully committed {len(texts)} vector records to collection: {collection.name}")
            return True
        except Exception as e:
            logger.error(f"Write operation failure during Chroma vector indexing for chatbot '{chatbot_id}': {str(e)}", exc_info=True)
            return False

    def similarity_search(self, chatbot_id: str, query: str, limit: int = 4) -> List[Dict[str, Any]]:
        """
        Executes a localized vector search strictly scoped to the tenant's collection namespace.
        """
        collection_name = self._get_clean_collection_name(chatbot_id)
        try:
            collection = self.client.get_collection(name=collection_name)
        except Exception:
            logger.warning(f"Vector space collection '{collection_name}' query issued before any document ingestion occurred.")
            return []

        try:
            # Generate the vector for the user's search query
            query_embedding = self.embedding_function.embed_query(query)
            
            results = collection.query(
                query_embeddings=[query_embedding],
                n_results=limit
            )
            
            formatted_results = []
            if results and results.get("documents") and results["documents"][0]:
                for idx in range(len(results["documents"][0])):
                    formatted_results.append({
                        "content": results["documents"][0][idx],
                        "metadata": results["metadatas"][0][idx] if results.get("metadatas") else {},
                        "distance": results["distances"][0][idx] if results.get("distances") else 0.0
                    })
            
            logger.info(f"Vector search returned {len(formatted_results)} matches from namespace: {collection_name}")
            return formatted_results
        except Exception as e:
            logger.error(f"Vector lookup execution failure in workspace namespace '{collection_name}': {str(e)}")
            return []