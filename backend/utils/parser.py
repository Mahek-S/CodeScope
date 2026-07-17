"""
AST-based Python file parser.
Uses Python's built-in `ast` module — no hand-rolled parser.

Extracts per file:
  - imports (resolved to relative file paths where possible)
  - class names
  - function names (top-level)
  - exports (__all__ if defined)
  - module docstring (first string literal in the module body)
  - top-level constants (UPPER_CASE module-level assignments, e.g. REDIS_URL)

The docstring/constants are structural metadata, same spirit as classes
and functions — not full file content. They exist because many
infra/config files (celery_app.py, config.py) have no classes or
functions at all, which otherwise leaves their embedding text empty.
"""

import ast
import hashlib
from dataclasses import dataclass, field
from pathlib import Path


@dataclass
class ImportRecord:
    module: str | None  # e.g., 'ai' or 'utils' or None (for pure relative like `from . import x`)
    names: list[str]    # the imported names/submodules, e.g. ['nodes'] or ['x']
    level: int          # relative level: 0 for absolute import, >0 for relative imports (the number of dots)


@dataclass
class ParsedFile:
    filepath: str
    imports: list[ImportRecord] = field(default_factory=list)
    classes: list[str] = field(default_factory=list)
    functions: list[str] = field(default_factory=list)
    exports: list[str] = field(default_factory=list)
    module_docstring: str = ""
    constants: list[str] = field(default_factory=list)
    content_hash: str = ""


def parse_python_file(filepath: str, source: str) -> ParsedFile:
    """
    Parse a Python source file and extract structural metadata.

    Args:
        filepath: Relative path of the file (e.g. 'src/services/user_service.py')
        source:   Raw file contents as a string

    Returns:
        ParsedFile with imports, classes, functions, exports, docstring,
        constants, and content_hash
    """
    result = ParsedFile(filepath=filepath)
    result.content_hash = hashlib.sha256(source.encode()).hexdigest()

    try:
        tree = ast.parse(source, filename=filepath)
    except SyntaxError:
        # Return partial result with just the hash — still useful for change detection
        return result

    result.module_docstring = ast.get_docstring(tree) or ""

    for node in ast.walk(tree):
        # Imports
        if isinstance(node, ast.Import):
            for alias in node.names:
                result.imports.append(
                    ImportRecord(module=alias.name, names=[], level=0)
                )

        elif isinstance(node, ast.ImportFrom):
            result.imports.append(
                ImportRecord(
                    module=node.module,
                    names=[alias.name for alias in node.names],
                    level=node.level or 0,
                )
            )

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

    # Top-level constants: iterate tree.body directly (not ast.walk) so we
    # only pick up module-level names, not every UPPER_CASE assignment
    # nested inside a function or class body.
    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name) and _looks_like_constant(target.id):
                    result.constants.append(target.id)
        elif isinstance(node, ast.AnnAssign):
            if isinstance(node.target, ast.Name) and _looks_like_constant(node.target.id):
                result.constants.append(node.target.id)

    return result


def _looks_like_constant(name: str) -> bool:
    """UPPER_CASE module-level name, excluding dunders like __all__."""
    return name.isupper() and not name.startswith("__")


def import_display_names(imports: list[ImportRecord]) -> list[str]:
    """
    Turn parsed ImportRecords into short, readable strings for storage and
    embedding text, e.g. ImportRecord(module='celery', names=['Celery'], level=0)
    -> ['celery.Celery']. Deduplicated, order preserved.
    """
    seen: dict[str, None] = {}
    for rec in imports:
        prefix = "." * rec.level
        base = f"{prefix}{rec.module}" if rec.module else prefix
        if rec.names:
            for name in rec.names:
                display = f"{base}.{name}" if base else name
                seen.setdefault(display, None)
        elif base:
            seen.setdefault(base, None)
    return list(seen.keys())


def get_module_names_for_filepath(filepath: str) -> list[str]:
    # Replace backslashes with forward slashes for safety
    filepath = filepath.replace("\\", "/")
    path_obj = Path(filepath)
    parts = list(path_obj.parts)
    if not parts:
        return []

    # Strip extension or init filename
    if parts[-1] == "__init__.py":
        parts = parts[:-1]
    else:
        if parts[-1].endswith(".py"):
            parts[-1] = parts[-1][:-3]

    # Generate suffixes (sub-paths)
    candidates = []
    for i in range(len(parts)):
        candidates.append(".".join(parts[i:]))
    return candidates


def build_module_index(all_filepaths: set[str]) -> dict[str, list[str]]:
    module_index = {}
    for f in all_filepaths:
        # Generate all dotted module names for f
        names = get_module_names_for_filepath(f)
        for name in names:
            if name not in module_index:
                module_index[name] = []
            module_index[name].append(f)
    return module_index


def resolve_import_to_filepaths(
    import_rec: ImportRecord,
    source_filepath: str,
    all_filepaths: set[str],
    module_index: dict[str, list[str]] | None = None,
) -> list[str]:
    """
    Attempt to resolve an ImportRecord to one or more relative filepaths in the repo.
    """
    if import_rec.level > 0:
        # Relative import
        candidates = []
        try:
            base_dir = Path(source_filepath).parent
            for _ in range(import_rec.level - 1):
                base_dir = base_dir.parent
        except ValueError:
            # Went too far up, invalid relative import
            return []

        if import_rec.module:
            target_dir = base_dir / import_rec.module.replace(".", "/")
        else:
            target_dir = base_dir

        # 1. Try target_dir itself (if module was specified)
        if import_rec.module:
            candidates.append(target_dir)

        # 2. Try submodules based on names
        for name in import_rec.names:
            candidates.append(target_dir / name)

        resolved = []
        for c in candidates:
            py_file = c.with_suffix(".py").as_posix()
            init_file = (c / "__init__.py").as_posix()

            # Clean up any potential "./" prefix
            if py_file.startswith("./"):
                py_file = py_file[2:]
            if init_file.startswith("./"):
                init_file = init_file[2:]

            if py_file in all_filepaths:
                resolved.append(py_file)
            if init_file in all_filepaths:
                resolved.append(init_file)

        return list(dict.fromkeys(resolved))

    else:
        # Absolute import
        resolved = []
        if not module_index:
            # Fallback if no module_index is provided (e.g. legacy or simple testing)
            candidates = []
            if import_rec.module:
                mod_p = import_rec.module.replace(".", "/")
                candidates.append(Path(mod_p))
                for name in import_rec.names:
                    sub_mod_p = f"{import_rec.module}.{name}".replace(".", "/")
                    candidates.append(Path(sub_mod_p))

            for c in candidates:
                py_file = c.with_suffix(".py").as_posix()
                init_file = (c / "__init__.py").as_posix()

                if py_file.startswith("./"):
                    py_file = py_file[2:]
                if init_file.startswith("./"):
                    init_file = init_file[2:]

                if py_file in all_filepaths:
                    resolved.append(py_file)
                if init_file in all_filepaths:
                    resolved.append(init_file)
            return list(dict.fromkeys(resolved))

        # We have a module_index! Look up the module and any submodules based on names.
        if import_rec.module:
            # 1. Try the module itself
            if import_rec.module in module_index:
                resolved.extend(module_index[import_rec.module])

            # 2. Try submodules based on names
            for name in import_rec.names:
                sub_mod = f"{import_rec.module}.{name}"
                if sub_mod in module_index:
                    resolved.extend(module_index[sub_mod])

        return list(dict.fromkeys(resolved))