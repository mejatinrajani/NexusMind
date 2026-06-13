import sys
from app.database.chroma_client import ChromaManager
from app.database.neo4j_client import Neo4jManager
from app.logger import setup_logger

logger = setup_logger("test_db")

def verify_databases():
    try:
        # 1. Test ChromaDB & Local Embedding Model
        logger.info("Booting up local ChromaDB and Hugging Face embeddings...")
        chroma = ChromaManager()
        logger.info("ChromaDB is fully operational.")

        # 2. Test Neo4j Connection
        logger.info("Pinging local Neo4j Desktop engine...")
        neo4j = Neo4jManager()
        logger.info("Neo4j connection pool established and verified.")

    except Exception as e:
        logger.critical(f"Database Verification Failed: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    verify_databases()