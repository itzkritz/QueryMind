"""
services/sql_explainer.py
=========================
AI Service to generate structured plain-English explanations of generated SQL queries.
Supports both Gemini and Ollama.
"""

import json
import logging
from typing import Dict, Any
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import HumanMessage
import requests as http_requests

from config import settings

logger = logging.getLogger(__name__)

EXPLAIN_PROMPT = """You are an expert SQL analyst. Explain the following SQL query in plain English.
The explanation must be structured as a JSON object.

SQL Query:
{sql}

User Question:
{question}

Database Schema Context:
{schema}

Format your output as a valid JSON object with the following keys. Do NOT include markdown code fences (like ```json) in your output, just return the raw JSON string:
{{
  "summary": "A clear, concise plain-English explanation of what this query does for non-technical users.",
  "tables_used": ["List of table names used in the query"],
  "joins": "Explain any joins performed, or return 'None'",
  "filters": "Explain any filters or WHERE clause criteria, or return 'None'",
  "aggregations": ["List of aggregations performed (e.g. SUM, COUNT, AVG, etc.) or 'None'"],
  "sorting_grouping": "Explain any GROUP BY or ORDER BY logic, or return 'None'"
}}
"""


class SQLExplainerService:
    @staticmethod
    def explain(sql: str, question: str, schema: str, provider: str) -> Dict[str, Any]:
        prompt = EXPLAIN_PROMPT.format(sql=sql, question=question, schema=schema)
        raw_response = ""

        try:
            if provider == "gemini":
                if not settings.GOOGLE_API_KEY:
                    raise ValueError("GOOGLE_API_KEY not configured.")
                llm = ChatGoogleGenerativeAI(
                    model="gemini-2.5-flash",
                    google_api_key=settings.GOOGLE_API_KEY,
                    temperature=0
                )
                raw_response = llm.invoke([HumanMessage(content=prompt)]).content
            elif provider == "ollama":
                resp = http_requests.post(
                    f"{settings.OLLAMA_HOST}/api/generate",
                    json={
                        "model": settings.OLLAMA_MODEL,
                        "prompt": prompt,
                        "stream": False,
                        "options": {"temperature": 0},
                        "format": "json"
                    },
                    timeout=30,
                )
                resp.raise_for_status()
                raw_response = resp.json()["response"]
            else:
                raise ValueError(f"Unknown provider: {provider}")

            # Clean markdown code fences if LLM ignored the instruction
            raw_response = raw_response.strip()
            if raw_response.startswith("```"):
                lines = raw_response.split("\n")
                if lines[0].startswith("```"):
                    lines = lines[1:]
                if lines and lines[-1].startswith("```"):
                    lines = lines[:-1]
                raw_response = "\n".join(lines).strip()

            data = json.loads(raw_response)

            # Ensure all required keys exist and format values nicely
            structured_data = {
                "summary": str(data.get("summary", "No summary generated.")),
                "tables_used": [str(t) for t in data.get("tables_used", [])] if isinstance(data.get("tables_used"), list) else [],
                "joins": str(data.get("joins", "None")),
                "filters": str(data.get("filters", "None")),
                "aggregations": [str(a) for a in data.get("aggregations", [])] if isinstance(data.get("aggregations"), list) else [],
                "sorting_grouping": str(data.get("sorting_grouping", "None"))
            }
            return structured_data

        except Exception as e:
            logger.error(f"Error generating SQL explanation: {e}. Raw response: {raw_response}")
            # Fallback structure
            return {
                "summary": "Could not generate automated explanation.",
                "tables_used": [],
                "joins": "None",
                "filters": "None",
                "aggregations": [],
                "sorting_grouping": "None"
            }
