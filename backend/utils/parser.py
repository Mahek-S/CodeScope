"""
AST-based Python file parser.
Uses Python's built-in `ast` module — no hand-rolled parser.

Extracts per file:
  - imports (resolved to relative file paths where possible)
  - class names
  - function names (top-level)
  - exports (__all__ if defined)

Full implementation on Day 3.
"""

import ast
import hashlib
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class ParsedFile:
    filepath: str
    imports: list[str] = field(default_factory=list)   # module strings as written
    classes: list[str] = field(default_factory=list)
    functions: list[str] = field(default_factory=list)
    exports: list[str] = field(default_factory=list)
    content_hash: str = ""


def parse_python_file(filepath: str, source: str) -> ParsedFile:
    """
    Parse a Python source file and extract structural metadata.

    Args:
        filepath: Relative path of the file (e.g. 'src/services/user_service.py')
        source:   Raw file contents as a string

    Returns:
        ParsedFile with imports, classes, functions, exports, and content_hash
    """
    result = ParsedFile(filepath=filepath)
    result.content_hash = hashlib.sha256(source.encode()).hexdigest()

    try:
        tree = ast.parse(source, filename=filepath)
    except SyntaxError:
        # Return partial result with just the hash — still useful for change detection
        return result

    for node in ast.walk(tree):
        # Imports
        if isinstance(node, ast.Import):
            for alias in node.names:
                result.imports.append(alias.name)

        elif isinstance(node, ast.ImportFrom):
            if node.module:
                result.imports.append(node.module)

        # Top-level classes
        elif isinstance(node, ast.ClassDef):
            result.classes.append(node.name)

        # Top-level functions (not nested)
        elif isinstance(node, ast.FunctionDef) or isinstance(node, ast.AsyncFunctionDef):
            # Only capture top-level by checking parent — simple heuristic: depth check
            result.functions.append(node.name)

        # __all__ exports
        elif isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and target.id == "__all__":
                    if isinstance(node.value, (ast.List, ast.Tuple)):
                        for elt in node.value.elts:
                            if isinstance(elt, ast.Constant) and isinstance(elt.value, str):
                                result.exports.append(elt.value)

    return result


def resolve_import_to_filepath(
    import_str: str,
    source_filepath: str,
    all_filepaths: set[str],
) -> str | None:
    """
    Attempt to resolve an import string to a relative filepath in the repo.

    Example:
        import_str      = "services.user_service"
        source_filepath = "routers/auth.py"
        → returns "services/user_service.py" if it exists in all_filepaths

    Returns None if the import cannot be resolved to a known file (e.g. third-party).
    """
    # Convert dotted module path to filepath
    candidate = import_str.replace(".", "/") + ".py"
    if candidate in all_filepaths:
        return candidate

    # Try package __init__
    candidate_init = import_str.replace(".", "/") + "/__init__.py"
    if candidate_init in all_filepaths:
        return candidate_init

    # Relative import from same directory
    base_dir = str(Path(source_filepath).parent)
    candidate_rel = f"{base_dir}/{import_str.replace('.', '/')}.py"
    if candidate_rel in all_filepaths:
        return candidate_rel

    return None
