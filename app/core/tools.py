import json
from typing import List, Dict, Any
from langchain_core.tools import tool
from duckduckgo_search import DDGS
from app.database.chroma_client import ChromaManager
from app.database.neo4j_client import Neo4jManager
from app.logger import setup_logger

logger = setup_logger("core.tools")

@tool
def vector_search_tool(query: str, chatbot_id: str) -> str:
    """
    Executes a semantic similarity search across the unstructured document chunks in ChromaDB.
    Use this tool for fact-retrieval, definitions, and finding specific paragraphs of text.
    
    Args:
        query: The user's specific question or semantic search phrase.
        chatbot_id: The isolated tenant workspace identifier.
    """
    logger.info(f"Agent invoked Vector Search for chatbot '{chatbot_id}' with query: '{query}'")
    chroma_mgr = ChromaManager()
    
    try:
        results = chroma_mgr.similarity_search(chatbot_id=chatbot_id, query=query, limit=5)
        
        if not results:
            return "No relevant semantic context found in the vector database for this query."
            
        # Format the results into a clean string for the LLM context window
        formatted_context = "--- Vector Semantic Matches ---\n"
        for idx, res in enumerate(results):
            source = res.get("metadata", {}).get("source", "Unknown Document")
            page = res.get("metadata", {}).get("page", "N/A")
            formatted_context += f"[Source: {source} | Page: {page}]\n{res['content']}\n\n"
            
        return formatted_context
    except Exception as e:
        logger.error(f"Vector search tool execution failed: {str(e)}")
        return "Error executing vector search."


@tool
def graph_search_tool(entities: List[str], chatbot_id: str) -> str:
    """
    Traverses the Neo4j Knowledge Graph to find structural relationships and multi-hop connections.
    Use this tool when the query asks about systemic impacts, connections between concepts, or hierarchical data.
    
    Args:
        entities: A list of core noun entities extracted from the user's query (e.g., ["HR Policy", "John Doe"]).
        chatbot_id: The isolated tenant workspace identifier.
    """
    logger.info(f"Agent invoked Graph Search for chatbot '{chatbot_id}' analyzing entities: {entities}")
    
    if not entities:
        return "No entities provided for graph traversal."

    neo4j_mgr = Neo4jManager()
    
    # Cypher query: Match nodes by approximate name (case-insensitive) within the tenant boundary, 
    # and return their direct relationships (1-hop neighborhood).
    cypher_query = """
    UNWIND $entities AS entity_name
    MATCH (n:Entity {chatbot_id: $chatbot_id})
    WHERE toLower(n.name) CONTAINS toLower(entity_name)
    MATCH (n)-[r]-(connected:Entity {chatbot_id: $chatbot_id})
    RETURN n.name AS source, type(r) AS relationship, connected.name AS target
    LIMIT 30
    """
    
    try:
        results = neo4j_mgr.execute_read(cypher_query, {"entities": entities, "chatbot_id": chatbot_id})
        
        if not results:
            return f"No relational graph data found connecting to the entities: {entities}."
            
        formatted_graph = "--- Knowledge Graph Relationships ---\n"
        for record in results:
            formatted_graph += f"({record['source']}) --[{record['relationship']}]--> ({record['target']})\n"
            
        return formatted_graph
    except Exception as e:
        logger.error(f"Graph search tool execution failed: {str(e)}")
        return "Error executing knowledge graph traversal."


@tool
def web_search_tool(query: str) -> str:
    """
    Executes a live internet search using DuckDuckGo.
    Use this tool ONLY as a fallback if the internal vector and graph databases lack the required information.
    
    Args:
        query: The search engine query string.
    """
    logger.info(f"Agent invoked Web Search Fallback for query: '{query}'")
    try:
        ddgs = DDGS()
        # Fetch top 3 web results
        results = list(ddgs.text(query, max_results=3))
        
        if not results:
            return "Web search returned no results."
            
        formatted_web = "--- Live Web Search Fallback ---\n"
        for res in results:
            formatted_web += f"Title: {res.get('title')}\nSource: {res.get('href')}\nSummary: {res.get('body')}\n\n"
            
        return formatted_web
    except Exception as e:
        logger.error(f"Web search tool execution failed: {str(e)}")
        return "Error executing external web search. The service might be rate-limited."