"""
services/chart_recommender.py
==============================
Analyzes query results (rows + SQL + question) and recommends the best
chart type to visualize the data.

Returns a ChartMeta dict:
  {
    "suitable":    bool,          # False = show table only
    "chart_type":  str | None,    # "line" | "bar" | "pie" | "area"
    "x_key":       str | None,    # column name for X-axis / category
    "y_keys":      list[str],     # column names for Y-axis (numeric)
    "title":       str | None,    # auto-generated chart title
  }
"""
from __future__ import annotations
import re
from typing import Any

# ── Column-name patterns ──────────────────────────────────────────────────────

# Columns that represent a TIME dimension → prefer Line chart
_TIME_PATTERNS = re.compile(
    r"\b(date|month|year|week|day|quarter|period|time|created|updated|timestamp|hour)\b",
    re.IGNORECASE,
)

# Columns that are clearly categorical (label / group)
_CATEGORY_PATTERNS = re.compile(
    r"\b(name|region|country|city|state|category|type|product|brand|department|"
    r"segment|channel|status|gender|platform|source|medium|label|group)\b",
    re.IGNORECASE,
)

# Columns that hold numeric values (metrics / measures)
_METRIC_PATTERNS = re.compile(
    r"\b(revenue|sales|profit|amount|total|sum|count|quantity|price|cost|"
    r"value|income|expense|margin|rate|percent|score|avg|average|balance|budget)\b",
    re.IGNORECASE,
)

# ── Question / SQL keyword triggers ──────────────────────────────────────────

_LINE_KEYWORDS   = re.compile(r"\b(trend|over time|growth|change|progress|monthly|yearly|daily|weekly|quarterly)\b", re.IGNORECASE)
_BAR_KEYWORDS    = re.compile(r"\b(by region|by country|by city|by category|by product|compare|comparison|rank|top|bottom|vs|versus)\b", re.IGNORECASE)
_PIE_KEYWORDS    = re.compile(r"\b(distribution|breakdown|share|proportion|percentage|split)\b", re.IGNORECASE)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _classify_columns(rows: list[dict[str, Any]]) -> tuple[list[str], list[str], list[str]]:
    """
    Returns (time_cols, category_cols, numeric_cols) based on data types
    and column name heuristics.
    """
    if not rows:
        return [], [], []

    sample = rows[0]
    time_cols: list[str]     = []
    category_cols: list[str] = []
    numeric_cols: list[str]  = []

    for col, val in sample.items():
        col_lower = col.lower()

        # Type-based numeric detection (fallback)
        is_numeric = isinstance(val, (int, float)) and not isinstance(val, bool)
        is_string  = isinstance(val, str)

        if _TIME_PATTERNS.search(col_lower):
            time_cols.append(col)
        elif _METRIC_PATTERNS.search(col_lower) and is_numeric:
            numeric_cols.append(col)
        elif is_numeric:
            numeric_cols.append(col)
        elif _CATEGORY_PATTERNS.search(col_lower) and is_string:
            category_cols.append(col)
        elif is_string:
            category_cols.append(col)

    return time_cols, category_cols, numeric_cols


def _auto_title(question: str, chart_type: str, x_key: str, y_keys: list[str]) -> str:
    """Generate a clean, human-readable chart title."""
    metric  = y_keys[0].replace("_", " ").title() if y_keys else "Values"
    dim     = x_key.replace("_", " ").title() if x_key else ""
    labels  = {
        "line": f"{metric} Over {dim}" if dim else f"{metric} Trend",
        "bar":  f"{metric} by {dim}"   if dim else f"{metric} Comparison",
        "pie":  f"{metric} Distribution by {dim}" if dim else f"{metric} Distribution",
        "area": f"{metric} Trend by {dim}" if dim else f"{metric} Over Time",
    }
    return labels.get(chart_type, question[:60])


# ── Public API ────────────────────────────────────────────────────────────────

class ChartRecommender:
    """
    Call ChartRecommender.recommend(rows, sql, question) → dict
    """

    @staticmethod
    def recommend(
        rows: list[dict[str, Any]],
        sql: str | None,
        question: str,
    ) -> dict:
        """
        Analyse rows + SQL + question and return a chart_meta dict.
        """
        _no_chart = {"suitable": False, "chart_type": None, "x_key": None, "y_keys": [], "title": None}

        # Need at least 2 rows for any chart to make sense
        if not rows or len(rows) < 2:
            return _no_chart

        sql_q = (sql or "") + " " + question

        time_cols, category_cols, numeric_cols = _classify_columns(rows)

        # Nothing to plot without at least one numeric column
        if not numeric_cols:
            return _no_chart

        # ── Rule 1: time column present → Line (or Area if multiple y-keys) ──
        if time_cols:
            x_key  = time_cols[0]
            y_keys = numeric_cols
            chart_type = "area" if len(y_keys) > 1 else "line"
            return {
                "suitable":   True,
                "chart_type": chart_type,
                "x_key":      x_key,
                "y_keys":     y_keys,
                "title":      _auto_title(question, chart_type, x_key, y_keys),
            }

        # ── Rule 2: question/SQL signals a trend / time series → Line ────────
        if _LINE_KEYWORDS.search(sql_q) and category_cols:
            x_key  = category_cols[0]
            y_keys = numeric_cols
            chart_type = "line"
            return {
                "suitable":   True,
                "chart_type": chart_type,
                "x_key":      x_key,
                "y_keys":     y_keys,
                "title":      _auto_title(question, chart_type, x_key, y_keys),
            }

        # ── Need a category dimension for the remaining chart types ───────────
        if not category_cols:
            return _no_chart

        x_key  = category_cols[0]
        y_keys = numeric_cols[:1]   # primary metric only for pie/bar

        # ── Rule 3: distribution keywords + small dataset → Pie ──────────────
        if _PIE_KEYWORDS.search(sql_q) and len(rows) <= 10:
            chart_type = "pie"
            return {
                "suitable":   True,
                "chart_type": chart_type,
                "x_key":      x_key,
                "y_keys":     y_keys,
                "title":      _auto_title(question, chart_type, x_key, y_keys),
            }

        # ── Rule 4: small categorical dataset (≤ 7) → Pie ────────────────────
        if len(rows) <= 7 and len(numeric_cols) == 1:
            chart_type = "pie"
            return {
                "suitable":   True,
                "chart_type": chart_type,
                "x_key":      x_key,
                "y_keys":     y_keys,
                "title":      _auto_title(question, chart_type, x_key, y_keys),
            }

        # ── Rule 5: multiple numeric columns → Area ───────────────────────────
        if len(numeric_cols) >= 2:
            y_keys = numeric_cols
            chart_type = "area"
            return {
                "suitable":   True,
                "chart_type": chart_type,
                "x_key":      x_key,
                "y_keys":     y_keys,
                "title":      _auto_title(question, chart_type, x_key, y_keys),
            }

        # ── Rule 6: bar signal or default categorical comparison → Bar ────────
        chart_type = "bar"
        return {
            "suitable":   True,
            "chart_type": chart_type,
            "x_key":      x_key,
            "y_keys":     y_keys,
            "title":      _auto_title(question, chart_type, x_key, y_keys),
        }
