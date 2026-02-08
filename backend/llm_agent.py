"""
llm_agent.py — Client for the Ollama local LLM API.

Sends dialog context to Ollama and returns concise interview hints.
"""

import logging
from typing import Optional

import requests

logger = logging.getLogger(__name__)

DEFAULT_SYSTEM_PROMPT = (
    "You are an assistant during a technical interview. "
    "You receive a dialog transcript. "
    "Your task: briefly analyze the interviewer's last question and generate "
    "1-2 key talking points for an answer, a code example, or a clarifying question. "
    "Be as concise as possible."
)


class LLMAgent:
    """Stateless wrapper around the Ollama ``/api/generate`` endpoint."""

    def __init__(
        self,
        base_url: str = "http://localhost:11434",
        model: str = "llama3.2:3b",
        system_prompt: str = DEFAULT_SYSTEM_PROMPT,
        max_tokens: int = 256,
        temperature: float = 0.3,
        timeout: int = 30,
    ):
        self.base_url = base_url.rstrip("/")
        self.model = model
        self.system_prompt = system_prompt
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.timeout = timeout

    def get_hint(self, dialog_context: str) -> str:
        """Send *dialog_context* to Ollama and return the generated hint.

        Returns an empty string on any error so the caller can safely ignore
        transient failures.
        """
        if not dialog_context.strip():
            return ""

        url = f"{self.base_url}/api/generate"
        payload = {
            "model": self.model,
            "prompt": dialog_context,
            "system": self.system_prompt,
            "stream": False,
            "options": {
                "num_predict": self.max_tokens,
                "temperature": self.temperature,
            },
        }
        try:
            resp = requests.post(url, json=payload, timeout=self.timeout)
            resp.raise_for_status()
            data = resp.json()
            return data.get("response", "").strip()
        except requests.ConnectionError:
            logger.error(
                "Cannot connect to Ollama at %s. Is the server running?",
                self.base_url,
            )
        except requests.Timeout:
            logger.warning("Ollama request timed out after %ds", self.timeout)
        except requests.HTTPError as exc:
            logger.warning("Ollama HTTP error: %s", exc)
        except Exception:
            logger.exception("Unexpected error calling Ollama")
        return ""

    def is_available(self) -> bool:
        """Check whether Ollama is reachable."""
        try:
            resp = requests.get(f"{self.base_url}/api/tags", timeout=5)
            return resp.status_code == 200
        except Exception:
            return False
