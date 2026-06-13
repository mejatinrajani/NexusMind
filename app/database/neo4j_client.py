import threading
from typing import Any, Dict, List, Optional
from neo4j import GraphDatabase, Driver
from neo4j.exceptions import ServiceUnavailable, AuthError
from app.config import settings
from app.logger import setup_logger

logger = setup_logger("database.neo4j_client")

class Neo4jManager:
    """
    Thread-safe Singleton connection pool manager for Neo4j.
    Prevents socket exhaustion and handles transaction lifecycles safely.
    """
    _instance: Optional["Neo4jManager"] = None
    _lock = threading.Lock()

    def __new__(cls, *args, **kwargs):
        """Enforces a global Singleton pattern to maintain a single connection pool."""
        with cls._lock:
            if cls._instance is None:
                cls._instance = super().__new__(cls)
                cls._instance._initialized = False
            return cls._instance

    def __init__(self):
        if self._initialized:
            return
            
        try:
            logger.info(f"Connecting to local Neo4j instance at: {settings.NEO4J_URI}")
            
            # Instantiate the driver with a connection pool
            self.driver: Driver = GraphDatabase.driver(
                uri=settings.NEO4J_URI,
                auth=(settings.NEO4J_USER, settings.NEO4J_PASSWORD),
                max_connection_lifetime=3600, # Recycle connections every hour
                max_connection_pool_size=50   # Handle up to 50 concurrent agent queries
            )
            
            # Ping the database to verify credentials and reachability instantly
            self.driver.verify_connectivity()
            
            self._initialized = True
            logger.info("Neo4j storage subsystem connection pooled and verified successfully.")
            
        except AuthError:
            logger.critical("Neo4j Authentication failed. Check NEO4J_USER and NEO4J_PASSWORD in your .env file.")
            raise
        except ServiceUnavailable:
            logger.critical(f"Neo4j is unreachable at {settings.NEO4J_URI}. Ensure the database is RUNNING in Neo4j Desktop.")
            raise
        except Exception as e:
            logger.critical(f"Fatal initialization error in Neo4j client: {str(e)}")
            raise e

    def close(self):
        """Gracefully shuts down the connection pool (used during FastAPI shutdown)."""
        if hasattr(self, 'driver') and self.driver is not None:
            self.driver.close()
            logger.info("Neo4j connection pool closed gracefully.")

    def execute_write(self, cypher_query: str, parameters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Executes a data-mutating Cypher query (CREATE, MERGE, SET, DELETE) securely.
        Uses managed transactions to automatically rollback on failure.
        """
        parameters = parameters or {}
        try:
            with self.driver.session() as session:
                result = session.execute_write(self._transaction_function, cypher_query, parameters)
                logger.info(f"Graph write transaction committed successfully.")
                return result
        except Exception as e:
            logger.error(f"Neo4j write transaction failed. Query: {cypher_query} | Error: {str(e)}", exc_info=True)
            return []

    def execute_read(self, cypher_query: str, parameters: Optional[Dict[str, Any]] = None) -> List[Dict[str, Any]]:
        """
        Executes a read-only Cypher query (MATCH, RETURN) securely.
        """
        parameters = parameters or {}
        try:
            with self.driver.session() as session:
                result = session.execute_read(self._transaction_function, cypher_query, parameters)
                return result
        except Exception as e:
            logger.error(f"Neo4j read transaction failed. Error: {str(e)}", exc_info=True)
            return []

    @staticmethod
    def _transaction_function(tx, query: str, parameters: dict) -> List[Dict[str, Any]]:
        """Internal helper to execute the query and unpack the Neo4j Record objects into native Python dicts."""
        result = tx.run(query, parameters)
        return [record.data() for record in result]