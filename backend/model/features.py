"""
Extracts structural features from a code snippet, independent of any
specific language's grammar — this is what makes the risk model usable
across 10+ languages without hand-coding a parser for each one. It's
intentionally shallow (brace/keyword counting, indentation, comment
density) rather than a real AST, which is the trade-off for "works
reasonably on any C-like/Python-like language" instead of "requires a
parser per language."
"""
import re
import numpy as np

BRANCH_KEYWORDS = ["if", "elif", "else if", "for", "while", "case", "switch", "catch", "except", "&&", "||"]
COMMENT_PATTERNS = [r"//.*", r"#.*", r"/\*[\s\S]*?\*/", r'"""[\s\S]*?"""', r"'''[\s\S]*?'''"]
TODO_PATTERN = re.compile(r"\b(TODO|FIXME|HACK|XXX)\b", re.IGNORECASE)
MAGIC_NUMBER_PATTERN = re.compile(r"(?<![\w.])(?!0\b|1\b)\d{2,}(?![\w.])")
EMPTY_CATCH_PATTERN = re.compile(r"(catch|except)[^\n{:]*[{:]\s*(pass|\}|\n\s*\})", re.IGNORECASE)
BARE_EXCEPT_PATTERN = re.compile(r"except\s*:", re.IGNORECASE)

FEATURE_NAMES = [
    "line_count",
    "avg_line_length",
    "max_indent_depth",
    "branch_density",
    "comment_ratio",
    "todo_count",
    "magic_number_density",
    "empty_catch_count",
    "bare_except_count",
    "avg_function_length",
]


def _estimate_max_indent_depth(lines: list[str]) -> int:
    depths = []
    for line in lines:
        stripped = line.lstrip(" \t")
        if not stripped:
            continue
        leading = len(line) - len(stripped)
        # Normalize tabs to 4 spaces-equivalent so mixed indentation doesn't skew this.
        tab_count = line[:leading].count("\t")
        space_count = leading - tab_count
        depths.append(tab_count + space_count // 2)
    return max(depths) if depths else 0


def _strip_comments(code: str) -> str:
    stripped = code
    for pattern in COMMENT_PATTERNS:
        stripped = re.sub(pattern, "", stripped)
    return stripped


def extract_features(code: str) -> np.ndarray:
    lines = code.split("\n")
    line_count = max(len(lines), 1)
    avg_line_length = sum(len(l) for l in lines) / line_count

    max_indent_depth = _estimate_max_indent_depth(lines)

    code_only = _strip_comments(code)
    branch_count = sum(code_only.lower().count(kw) for kw in BRANCH_KEYWORDS)
    branch_density = branch_count / line_count

    comment_chars = len(code) - len(code_only)
    comment_ratio = comment_chars / max(len(code), 1)

    todo_count = len(TODO_PATTERN.findall(code))
    magic_number_density = len(MAGIC_NUMBER_PATTERN.findall(code_only)) / line_count
    empty_catch_count = len(EMPTY_CATCH_PATTERN.findall(code))
    bare_except_count = len(BARE_EXCEPT_PATTERN.findall(code))

    # Rough function-length proxy: count function/def/method openers, divide
    # total lines by that count as an average "chunk size".
    fn_openers = len(re.findall(r"\b(def|function|func|void|public|private|static)\b", code_only))
    avg_function_length = line_count / max(fn_openers, 1)

    return np.array(
        [
            line_count,
            avg_line_length,
            max_indent_depth,
            branch_density,
            comment_ratio,
            todo_count,
            magic_number_density,
            empty_catch_count,
            bare_except_count,
            avg_function_length,
        ],
        dtype=np.float32,
    )
