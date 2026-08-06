"""
LLM client for the impact-analysis workflow's reasoning step.

Provider is chosen by whichever API key is configured in settings --
matches the tech stack's "Claude API or OpenAI GPT-4o". SDK imports are
lazy (inside the functions that need them) so the rest of the app
doesn't require either package installed just to import this module,
the same pattern utils/embeddings.py uses for sentence-transformers.
"""
from __future__ import annotations

from config import settings
import json


# "-latest" aliases track the newest snapshot of each model family
# without pinning a specific dated model name here.
ANTHROPIC_MODEL = "claude-3-5-sonnet-latest"
OPENAI_MODEL = "gpt-4o"
GEMINI_MODEL = "gemini-3.5-flash"

MAX_TOKENS = 1024


async def call_llm(system_prompt: str, user_prompt: str) -> str:
    """
    Send the impact-analysis prompt to whichever LLM provider is
    configured and return the raw text response.

    Raises RuntimeError if neither ANTHROPIC_API_KEY nor OPENAI_API_KEY
    is set. Callers (ai/nodes.llm_reasoning) catch this -- and any other
    provider error -- and degrade gracefully rather than failing the
    whole analysis, since the deterministic risk score is still useful
    on its own.
    """
    if settings.gemini_api_key:
        return await _call_gemini(system_prompt, user_prompt)
    if settings.anthropic_api_key:
        return await _call_anthropic(system_prompt, user_prompt)
    if settings.openai_api_key:
        return await _call_openai(system_prompt, user_prompt)
    raise RuntimeError(
        "No LLM configured -- set ANTHROPIC_API_KEY or OPENAI_API_KEY"
    )


async def _call_anthropic(system_prompt: str, user_prompt: str) -> str:
    from anthropic import AsyncAnthropic

    client = AsyncAnthropic(api_key=settings.anthropic_api_key)
    response = await client.messages.create(
        model=ANTHROPIC_MODEL,
        max_tokens=MAX_TOKENS,
        system=system_prompt,
        messages=[{"role": "user", "content": user_prompt}],
    )
    return "".join(block.text for block in response.content if block.type == "text")

async def _call_gemini(system_prompt: str, user_prompt: str) -> str:
    from google import genai
    client = genai.Client(api_key=settings.gemini_api_key)

    response = await client.aio.models.generate_content(
        model=GEMINI_MODEL,
        contents=f"""System:
{system_prompt}

User:
{user_prompt}
""",
    )

    return response.text or ""

async def _call_openai(system_prompt: str, user_prompt: str) -> str:
    from openai import AsyncOpenAI

    client = AsyncOpenAI(api_key=settings.openai_api_key)
    response = await client.chat.completions.create(
        model=OPENAI_MODEL,
        max_tokens=MAX_TOKENS,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
    )
    return response.choices[0].message.content or ""


def parse_llm_response(raw_text: str) -> tuple[str, list[str]]:
    """
    Parse the strict JSON contract from IMPACT_ANALYSIS_SYSTEM_PROMPT.
    Falls back to a minimal shape if the model didn't return valid JSON --
    a malformed response degrades the analysis rather than failing it,
    same policy as every other LLM failure mode here.
    """
    empty = {"risk_summary": "", "evidence": [], "potential_issues": [], "suggested_tests": []}
    if not raw_text:
        return empty

    text = raw_text.strip()
    if text.startswith("```"):
        text = text.strip("`")
        text = text.split("\n", 1)[1] if "\n" in text else text
        text = text.rsplit("```", 1)[0] if "```" in text else text

    try:
        data = json.loads(text)
    except json.JSONDecodeError:
        return {**empty, "risk_summary": raw_text.strip()[:500]}

    return {
        "risk_summary": str(data.get("risk_summary", "")),
        "evidence": [str(x) for x in data.get("evidence", []) if x],
        "potential_issues": [str(x) for x in data.get("potential_issues", []) if x],
        "suggested_tests": [str(x) for x in data.get("suggested_tests", []) if x],
    }