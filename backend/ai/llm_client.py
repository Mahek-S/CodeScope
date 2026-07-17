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

# "-latest" aliases track the newest snapshot of each model family
# without pinning a specific dated model name here.
ANTHROPIC_MODEL = "claude-3-5-sonnet-latest"
OPENAI_MODEL = "gpt-4o"

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
    Parse the "EXPLANATION: ... / SUGGESTED_TESTS: - ..." format defined
    in ai/prompts.IMPACT_ANALYSIS_USER_TEMPLATE.

    Falls back to treating the whole response as the explanation, with
    no suggested tests, if the model didn't follow the format -- a
    slightly malformed LLM response shouldn't fail the whole analysis.
    """
    if not raw_text:
        return "", []

    if "SUGGESTED_TESTS:" in raw_text:
        explanation_part, tests_part = raw_text.split("SUGGESTED_TESTS:", 1)
        explanation = explanation_part.replace("EXPLANATION:", "").strip()
        suggested_tests = [
            line.strip().lstrip("-").strip()
            for line in tests_part.strip().splitlines()
            if line.strip().startswith("-")
        ]
        return explanation, suggested_tests

    return raw_text.replace("EXPLANATION:", "").strip(), []