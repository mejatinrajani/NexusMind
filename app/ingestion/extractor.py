import json
from typing import List, Dict, Any
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from app.config import settings
from app.database.neo4j_client import Neo4jManager
from app.logger import setup_logger

logger = setup_logger("ingestion.extractor")

class GraphExtractor:
    """
    LLM-powered knowledge graph extraction engine.
    Parses unstructured text chunks into tenant-isolated Cypher structures for Neo4j.
    """

    def __init__(self):
        # Initialize the high-throughput Groq LLM client
        self.llm = ChatGroq(
            temperature=0.0,  # Absolute deterministic extraction
            groq_api_key=settings.GROQ_API_KEY,
            model_name=settings.ROUTING_LLM  # Using a fast, reliable model for extraction tasks
        )
        self.neo4j_mgr = Neo4jManager()
        
        # Define a zero-shot structured extraction prompt
        self.extraction_prompt = ChatPromptTemplate.from_messages([
            ("system", (
                "You are an expert Knowledge Graph engineer extraction system.\n"
                "Your job is to read the provided text chunk and extract all core entities and their relationships.\n\n"
                "Format your entire response as a single, valid JSON object containing exactly two keys:\n"
                "1. 'entities': A list of objects, where each object has 'name' (noun, capitalized, brief) and 'type' (e.g., Company, Person, Policy, Process, Tool).\n"
                "2. 'relationships': A list of objects, where each object has 'source' (entity name), 'target' (entity name), and 'type' (verb phrase, uppercase with underscores, e.g., EMPLOYS, HAS_POLICY, DEPENDS_ON).\n\n"
                "Do not include any chat commentary or conversational prose. Return ONLY the raw valid JSON codeblock."
            )),
            ("human", "Extract from this text chunk:\n\n{text_chunk}")
        ])

    def _extract_from_llm(self, text_chunk: str, max_retries: int = 3) -> Dict[str, List[Dict[str, Any]]]:
        """Invokes Groq LLM to perform structured entity-relation extraction with self-healing retry logic."""
        
        # Force the Groq API to return strictly valid JSON
        llm_with_json = self.llm.bind(response_format={"type": "json_object"})
        chain = self.extraction_prompt | llm_with_json

        for attempt in range(max_retries):
            try:
                response = chain.invoke({"text_chunk": text_chunk})
                
                # Clean up the output to safeguard against accidental markdown block wrappers
                raw_content = response.content.strip()
                if raw_content.startswith("```json"):
                    raw_content = raw_content.split("```json")[1].split("```")[0].strip()
                elif raw_content.startswith("```"):
                    raw_content = raw_content.split("```")[1].split("```")[0].strip()

                return json.loads(raw_content)

            except json.JSONDecodeError as e:
                logger.warning(f"JSON parsing failed on attempt {attempt + 1}/{max_retries}. Error: {e}")
                if attempt == max_retries - 1:
                    logger.error(f"LLM extraction completely failed after {max_retries} attempts. Bypassing chunk.")
                    return {"entities": [], "relationships": []}
            except Exception as e:
                logger.error(f"Unexpected LLM extraction error on attempt {attempt + 1}: {str(e)}")
                if attempt == max_retries - 1:
                    return {"entities": [], "relationships": []}

    def write_chunk_to_graph(self, chatbot_id: str, chunk_data: Dict[str, Any]) -> bool:
        """
        Extracts triples from a chunk and flushes them to Neo4j with multi-tenant locks.
        """
        text_content = chunk_data["text"]
        metadata = chunk_data["metadata"]
        
        # 1. Run LLM Extraction (Now features internal retries)
        graph_data = self._extract_from_llm(text_content)
        
        entities = graph_data.get("entities", [])
        relationships = graph_data.get("relationships", [])

        if not entities and not relationships:
            return False

        # 2. Cypher statement to ingest uniquely and secure multi-tenancy via properties
        # We merge nodes on (name + chatbot_id) to guarantee tenant borders
        entity_query = """
        UNWIND $entities AS ent
        MERGE (n:Entity {name: ent.name, chatbot_id: $chatbot_id})
        ON CREATE SET n.type = ent.type, n.created_at = timestamp()
        ON MATCH SET n.type = ent.type
        """
        
        # Relationship statement connecting the newly merged tenant nodes
        relationship_query = """
        UNWIND $relationships AS rel
        MATCH (source:Entity {name: rel.source, chatbot_id: $chatbot_id})
        MATCH (target:Entity {name: rel.target, chatbot_id: $chatbot_id})
        // Use APOC or standard dynamic type workaround by applying an generic edge labeled 'RELATES_TO' 
        // with a dynamic property for precise tracking or matching standard types
        MERGE (source)-[r:RELATES_TO {type: rel.type, chatbot_id: $chatbot_id}]->(target)
        ON CREATE SET r.created_at = timestamp(), r.source_chunk = $chunk_id
        """

        try:
            # Commit entities
            self.neo4j_mgr.execute_write(
                entity_query, 
                {"entities": entities, "chatbot_id": chatbot_id}
            )
            
            # Commit relationships if entities exist to support them
            if relationships:
                self.neo4j_mgr.execute_write(
                    relationship_query, 
                    {
                        "relationships": relationships, 
                        "chatbot_id": chatbot_id,
                        "chunk_id": metadata.get("chunk_id", "unknown")
                    }
                )
            
            logger.info(f"Successfully loaded {len(entities)} nodes and {len(relationships)} edges into Neo4j for chatbot: {chatbot_id}")
            return True
        except Exception as e:
            logger.error(f"Failed to persist extracted triples into Neo4j graph storage: {str(e)}")
            return False