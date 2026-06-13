from pydantic import BaseModel, Field
from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from app.config import settings
from app.logger import setup_logger

logger = setup_logger("core.agents")

# --- Structured Output Pydantic Schemas ---

class RouteDecision(BaseModel):
    """Schema forcing the LLM to output a strict routing decision."""
    datasource: str = Field(
        description="The chosen data source to answer the question. Must be one of: 'vector', 'graph', 'web', 'direct_answer'"
    )
    reasoning: str = Field(description="Brief explanation of why this source was chosen.")

class GradeDecision(BaseModel):
    """Schema forcing the LLM to output a strict binary grade."""
    score: str = Field(description="A binary score 'yes' or 'no'.")
    reasoning: str = Field(description="Brief explanation for why this score was given.")


# --- Autonomous Multi-Agent Manager ---

class AgentManager:
    """
    Initializes and orchestrates the autonomous LLM agents (Router and Grader)
    using fast, structured outputs for deterministic LangGraph control flow.
    """
    def __init__(self):
        # We use the smaller, faster 8B model for structural decisions to save latency
        self.routing_llm = ChatGroq(
            temperature=0.0, # Deterministic outputs only
            groq_api_key=settings.GROQ_API_KEY,
            model_name=settings.ROUTING_LLM
        )
        
        # Bind the LLMs to the Pydantic schemas to guarantee JSON-structured output
        self.router = self.routing_llm.with_structured_output(RouteDecision)
        self.grader = self.routing_llm.with_structured_output(GradeDecision)

        # --- System Prompts ---
        self.router_prompt = ChatPromptTemplate.from_messages([
            ("system", (
                "You are the Supervisor Router for a hybrid Agentic GraphRAG system.\n"
                "Your job is to route the user's query to the most appropriate tool.\n"
                "- Choose 'vector' for simple fact-finding, definitions, or fetching specific paragraphs.\n"
                "- Choose 'graph' for multi-hop questions, hierarchical structures, systemic impacts, or relational inquiries (e.g., 'Who reports to X?', 'What depends on Y?').\n"
                "- Choose 'web' for current events or general knowledge clearly outside private internal documents.\n"
                "- Choose 'direct_answer' for simple conversational greetings (e.g., 'Hello', 'Who are you?')."
            )),
            ("human", "Question: {question}")
        ])

        self.relevance_prompt = ChatPromptTemplate.from_messages([
            ("system", (
                "You are a strict Relevance Grader.\n"
                "Evaluate if the retrieved document contains semantic or structural information relevant to the user's question.\n"
                "It does not need to answer the question entirely, just be relevant to the topic. Grade 'yes' if relevant, 'no' if completely irrelevant."
            )),
            ("human", "Retrieved Document Data: \n\n{document}\n\nUser Question: {question}")
        ])

    def route_question(self, question: str) -> RouteDecision:
        """Determines which tool pipeline to execute based on the user's query."""
        logger.info(f"Supervisor evaluating routing strategy for question: '{question}'")
        try:
            chain = self.router_prompt | self.router
            decision = chain.invoke({"question": question})
            logger.info(f"Supervisor routed to: {decision.datasource} | Reason: {decision.reasoning}")
            return decision
        except Exception as e:
            logger.error(f"Routing failure: {str(e)}. Defaulting to vector search safety net.")
            # Safety net: If the LLM fails to format JSON properly, default to vector search
            return RouteDecision(datasource="vector", reasoning="Fallback due to parsing error.")

    def grade_document_relevance(self, question: str, document: str) -> GradeDecision:
        """Grades if a retrieved chunk or graph relationship is actually relevant."""
        try:
            chain = self.relevance_prompt | self.grader
            decision = chain.invoke({"question": question, "document": document})
            logger.info(f"Grader scored document relevance: {decision.score} | Reason: {decision.reasoning}")
            return decision
        except Exception as e:
            logger.error(f"Relevance grading API failure: {str(e)}")
            # Safety net: Do not drop data if the evaluation API briefly times out
            return GradeDecision(score="yes", reasoning="Fallback to 'yes' due to API error.")