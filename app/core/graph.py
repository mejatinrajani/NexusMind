from typing import Dict, Any, List
from typing_extensions import TypedDict
from langchain_core.messages import BaseMessage
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langgraph.graph import StateGraph, END
from app.database.sql_client import get_bot
from app.config import settings
from app.logger import setup_logger
from app.core.agents import AgentManager
from app.core.tools import vector_search_tool, graph_search_tool, web_search_tool

logger = setup_logger("core.graph")

class GraphState(TypedDict):
    question: str
    chatbot_id: str
    system_prompt: str
    datasource: str
    documents: str
    steps: List[str]
    generation: str


class GraphEngine:
    def __init__(self):
        self.agents = AgentManager()
        self.generation_llm = ChatGroq(
            temperature=0.3,
            groq_api_key=settings.GROQ_API_KEY,
            model_name=settings.REASONING_LLM
        )
        self.workflow = self._compile_workflow()

    def _compile_workflow(self) -> StateGraph:
        builder = StateGraph(GraphState)
        
        builder.add_node("router_node", self.node_route_query)
        builder.add_node("vector_retriever", self.node_retrieve_vector)
        builder.add_node("graph_retriever", self.node_retrieve_graph)
        builder.add_node("web_retriever", self.node_retrieve_web)
        builder.add_node("generator_node", self.node_generate_answer)
        
        builder.set_entry_point("router_node")
        
        builder.add_conditional_edges(
            "router_node",
            self.decide_next_hop,
            {
                "vector": "vector_retriever",
                "graph": "graph_retriever",
                "web": "web_retriever",
                "direct_answer": "generator_node"
            }
        )
        
        builder.add_edge("vector_retriever", "generator_node")
        builder.add_edge("graph_retriever", "generator_node")
        builder.add_edge("web_retriever", "generator_node")
        builder.add_edge("generator_node", END)
        
        return builder.compile()

    def node_route_query(self, state: GraphState) -> Dict[str, Any]:
        logger.info("=== LangGraph Execution Block: Supervisor Routing ===")
        question = state["question"]
        decision = self.agents.route_question(question)
        
        current_steps = state.get("steps", [])
        current_steps.append(f"routed_to_{decision.datasource}")
        
        return {
            "datasource": decision.datasource,
            "steps": current_steps
        }

    def node_retrieve_vector(self, state: GraphState) -> Dict[str, Any]:
        logger.info("=== LangGraph Execution Block: ChromaDB Vector Retrieval ===")
        question = state["question"]
        chatbot_id = state["chatbot_id"]
        
        context = vector_search_tool.invoke({"query": question, "chatbot_id": chatbot_id})
        grade = self.agents.grade_document_relevance(question, context)
        
        current_steps = state.get("steps", [])
        current_steps.append("vector_retrieval_executed")
        
        if grade.score == "no":
            logger.warning("Retrieved vector context scored irrelevant. Diverting to web fallback channel.")
            current_steps.append("graded_irrelevant_diverting_to_web")
            return {"documents": "", "datasource": "web", "steps": current_steps}
            
        return {"documents": context, "steps": current_steps}

    def node_retrieve_graph(self, state: GraphState) -> Dict[str, Any]:
        logger.info("=== LangGraph Execution Block: Neo4j Graph Retrieval ===")
        question = state["question"]
        chatbot_id = state["chatbot_id"]
        
        entities = [word.strip(",.?!") for word in question.split() if word[0].isupper()]
        if not entities:
            entities = [question]
            
        context = graph_search_tool.invoke({"entities": entities, "chatbot_id": chatbot_id})
        
        current_steps = state.get("steps", [])
        current_steps.append("graph_retrieval_executed")
        return {"documents": context, "steps": current_steps}

    def node_retrieve_web(self, state: GraphState) -> Dict[str, Any]:
        logger.info("=== LangGraph Execution Block: External Web Fallback Invocations ===")
        question = state["question"]
        
        context = web_search_tool.invoke({"query": question})
        
        current_steps = state.get("steps", [])
        current_steps.append("web_fallback_executed")
        return {"documents": context, "steps": current_steps}

    def node_generate_answer(self, state: GraphState) -> Dict[str, Any]:
        """Assembles context and prompts the primary LLM using the bot's custom system prompt."""
        logger.info("=== LangGraph Execution Block: Generative Synthesis Assembly ===")
        question = state["question"]
        chatbot_id = state["chatbot_id"]
        documents = state.get("documents", "")
        datasource = state.get("datasource", "direct_answer")
        
        current_steps = state.get("steps", [])
        current_steps.append("final_synthesis_completed")
        
        # ---> NEW: Fetch custom instructions from the SQL Database <---
        bot_config = get_bot(chatbot_id)
        if bot_config and bot_config.system_prompt:
            custom_instructions = bot_config.system_prompt
        else:
            custom_instructions = "You are a helpful, intelligent organizational knowledge assistant."
            
        if datasource == "direct_answer" or not documents:
            prompt_text = (
                f"{custom_instructions}\n"
                "Respond conversationally, cleanly, and briefly to the user's greeting or baseline question.\n\n"
                f"Question: {question}"
            )
        else:
            prompt_text = (
                f"{custom_instructions}\n\n"
                "Synthesize a structured, accurate response. Rely strictly on the provided Context Material. "
                "If the answer cannot be found in the context, do not hallucinate.\n\n"
                f"Context Material:\n{documents}\n\n"
                f"User Question: {question}"
            )

        try:
            response = self.generation_llm.invoke(prompt_text)
            return {"generation": response.content, "steps": current_steps}
        except Exception as e:
            logger.error(f"Generation synthesis block failed: {str(e)}")
            return {"generation": "I encountered an issue processing that answer. Please try again.", "steps": current_steps}

    @staticmethod
    def decide_next_hop(state: GraphState) -> str:
        return state["datasource"]