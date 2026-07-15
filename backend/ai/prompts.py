"""
LLM prompt templates for the impact analysis workflow.
The LLM explains the risk; it does not invent the risk level.
"""

IMPACT_ANALYSIS_SYSTEM_PROMPT = """\
You are a senior software engineer reviewing a pull request's blast radius.
You will be given:
  - The changed files
  - The directly and transitively affected modules
  - A deterministic risk score (already computed — do NOT override it)
  - Similar past bugs or incidents

Your job is to explain the risk in plain English and suggest which test files to rerun.
Be concise, specific, and technical. Do not pad your answer with caveats.
"""

IMPACT_ANALYSIS_USER_TEMPLATE = """\
## Pull Request #{pr_number}

**Risk Level:** {risk_level} (score: {risk_score})

**Changed Files:**
{changed_files}

**Directly Affected Modules:**
{directly_affected}

**Transitively Affected Modules:**
{transitively_affected}

**Similar Past Bugs:**
{similar_bugs}

---

Explain in 3–5 sentences why this change carries {risk_level} risk.
Then list the test files that should be re-run, one per line, prefixed with `- `.
Format your response as:

EXPLANATION:
<your explanation here>

SUGGESTED_TESTS:
- path/to/test_file.py
- path/to/another_test.py
"""
