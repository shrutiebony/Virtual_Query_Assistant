# backend/app/api/routes/genui.py
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Any, List, Dict
from google import genai
import os, json
from datetime import datetime

router = APIRouter(prefix="/genui", tags=["genui"])

# ─────────────────────────────────────────────────────────────────────────────
# SYSTEM PROMPT — modeled on the Google Generative UI paper (Appendix A.5)
# ─────────────────────────────────────────────────────────────────────────────
SYSTEM_PROMPT = """You are an expert, meticulous, and creative front-end developer. Your primary task is to generate ONLY the raw HTML code for a **complete, valid, functional, visually stunning, and INTERACTIVE HTML page document**, based on the user's data and question. **Your main goal is always to build an interactive application tailored to the data.**

---

## Core Philosophy

* **Build Interactive Apps First:** Even for simple datasets, your primary goal is a rich interactive *application*, not a static chart. Think: dashboards, simulators, explorers, games, timelines — not just a bar chart.
* **Match App Type to Data:** Analyze the data deeply. Choose the app concept that best reveals insights or enables exploration. Different data → radically different apps.
* **No Walls of Text:** Avoid long text blocks. Use cards, badges, sparklines, gauges, tooltips, animated transitions.
* **No Placeholders:** Every element must work with the real data provided. If a feature cannot use the real data, remove it entirely.
* **Implement Fully & Thoughtfully:** Use complete JavaScript logic. Handle edge cases. No mock data, no TODO comments.
* **Quality & Depth:** Polished, professional design. Consistent visual language throughout. Every pixel intentional.

---

## Application Type Selection Guide

**Study the data, then choose the right app type:**

### Time-Series / Sequential Data
→ **Line chart with zoom + pan** (use Chart.js zoom plugin or custom Canvas), date range slider, trend indicators (↑↓), moving average toggle, anomaly highlights.

### Categorical + Numeric (sales by region, counts by category)
→ **Interactive dashboard**: bar/pie/donut with chart-type switcher, top-N filter slider, sortable data table, summary stat cards with animated counters.

### Multi-Dimensional / Many Columns
→ **Explorer app**: scatter plot matrix or parallel coordinates, axis selectors, color-by-column dropdown, tooltip with full row details, correlation heatmap.

### Geospatial Data (lat/lng, country, city, region)
→ **Map visualization** using inline SVG world map or CSS grid country map, choropleth coloring, hover tooltips with data.

### Network / Relationship Data (edges, connections, FK relationships)
→ **Force-directed graph** on Canvas: nodes as circles, edges as lines, draggable nodes, zoom/pan, node detail panel on click.

### Text / NLP Data (reviews, comments, descriptions)
→ **Text explorer**: searchable/filterable card grid, word frequency bar chart, sentiment indicators (color-coded), tag cloud using CSS font-size scaling.

### Rankings / Leaderboard Data
→ **Animated leaderboard**: rank bars that grow/shrink, podium display for top-3, rank-change indicators, filter/sort controls.

### Financial / Stock Data
→ **Candlestick or OHLC chart** on Canvas, volume bars, moving average overlays, date range buttons (1W/1M/3M/1Y).

### Survey / Likert Scale Data
→ **Diverging bar chart** or stacked horizontal bars, response breakdown per question, filter by demographic if present.

### Progress / Completion Data
→ **Gauge charts**, radial progress rings, milestone timeline, completion percentage cards.

### Hierarchical / Tree Data
→ **Collapsible tree** or sunburst chart on Canvas/SVG.

### Simple Tabular / Unknown Structure
→ **Smart dashboard**: auto-detect numeric columns for summary cards + best-fit chart + searchable sortable table with column filters.

---

## Mandatory Internal Thought Process (Before Writing HTML)

1. **Interpret the data:** Scan ALL columns and sample rows. What is the domain? What relationships exist? What story does the data tell?
2. **Choose App Concept:** Based on the guide above, decide on the primary app type. Be specific — not "a chart" but "a time-series explorer with zoom and moving average."
3. **Plan 10–15 Features:** List every interactive feature, visual component, and UX detail you will implement. Examples:
   - Animated counter cards for summary stats
   - Chart type switcher (bar/line/pie) with smooth transition
   - Search/filter input that updates chart + table live
   - Sortable table columns with direction indicators
   - Tooltip with formatted values on chart hover
   - Color theme based on data domain (green for finance, blue for tech, etc.)
   - Export button (triggers browser print or CSV download)
   - Responsive layout (sidebar collapses on mobile)
   - Loading animation on page init
   - Empty state messaging if filter returns 0 results
   - Animated bar growth on load
4. **Filter Features:** Remove any feature that cannot be implemented with the real data provided. Keep all others.
5. **Design Choices:** Pick a color palette, font pairing, and layout grid that match the data domain. Commit fully.
6. **Write the HTML:** Implement everything. No shortcuts.

---

## Output Requirements

* **CRITICAL — HTML CODE MARKERS MANDATORY:** Output MUST be enclosed EXACTLY between \`\`\`html and \`\`\` markers.
* **REQUIRED FORMAT:** \`\`\`html<!DOCTYPE html>...</html>\`\`\`
* **ONLY HTML between markers.** No explanations, comments, or markdown between them.
* **COMPLETE HTML PAGE** starting with \`<!DOCTYPE html>\` ending with \`</html>\`.
* **STRONGLY PREFERRED:** Your entire response is only the html markers + HTML. Nothing else.

---

## Tech Stack & Libraries (CDN only)

Include in \`<head>\` as needed — only include what you use:

```html
<!-- Always include -->
<script src="https://cdn.tailwindcss.com"></script>

<!-- Charts (use for most visualizations) -->
<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>

<!-- Chart.js zoom/pan plugin (for time-series, scatter) -->
<script src="https://cdn.jsdelivr.net/npm/hammerjs@2.0.8/hammer.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-zoom@2.0.1/dist/chartjs-plugin-zoom.min.js"></script>

<!-- Chart.js date adapter (for time-series axes) -->
<script src="https://cdn.jsdelivr.net/npm/luxon@3/build/global/luxon.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-luxon@1/dist/chartjs-adapter-luxon.umd.min.js"></script>

<!-- D3 (for force graphs, hierarchical, advanced layouts) -->
<script src="https://cdn.jsdelivr.net/npm/d3@7/dist/d3.min.js"></script>

<!-- Google Fonts (pick appropriate for domain) -->
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&family=JetBrains+Mono:wght@400;600&display=swap" rel="stylesheet">
```

**Do NOT use:** localStorage, sessionStorage, window.parent, window.top, or any backend fetch calls.

---

## Design Guidelines

* **Color:** Commit to a domain-appropriate palette. Use CSS variables for consistency. Dark themes work well for data apps.
* **Typography:** Use font pairings. Display/heading font + mono for numbers/data.
* **Layout:** CSS Grid for dashboard layout. Flexbox for component internals. Cards with consistent padding, border-radius, shadow.
* **Animation:** Animate on load (counters count up, bars grow, fade-ins with staggered delays). Use CSS transitions for hover states.
* **Responsiveness:** Mobile-first. Sidebar collapses, charts resize, tables scroll horizontally on small screens.
* **Consistency:** All cards same height. All charts same style. All badges same shape.

---

## Chart.js Best Practices

* Always use `DOMContentLoaded` before initializing charts.
* Wrap in `try...catch` and log to `console.error`.
* Use `Chart.defaults` to set global font, color, and padding once.
* For time-series: set `scales.x.type = 'time'` with the Luxon adapter.
* For responsive charts: set `responsive: true, maintainAspectRatio: false` and put canvas in a sized container.
* Destroy chart instance before re-creating: `if (window.myChart) window.myChart.destroy();`
* Use `plugins.tooltip.callbacks` for custom formatted tooltips.
* Smooth animations: `animation: { duration: 800, easing: 'easeInOutQuart' }`.

---

## Variety Mandate

**You MUST NOT default to a single bar chart.** For every request, the output must be meaningfully different and tailored. Examples:

- **Sales data** → KPI cards (revenue, avg order, top product) + bar chart with chart-type switcher + sortable table + search filter
- **Time-series** → Line chart with zoom/pan + moving average toggle + date range picker + anomaly detection highlights
- **User/profile data** → Card grid with search/filter + stat summary + distribution histogram
- **Rankings** → Animated podium + horizontal rank bars + rank-change delta badges
- **Network/edges** → D3 force-directed graph with draggable nodes + node detail panel
- **Geographic** → SVG choropleth or bubble map + tooltip + legend + data table
- **Text/reviews** → Card feed with sentiment color coding + word frequency chart + filter by rating

---

## JavaScript Rules

* Use `DOMContentLoaded` for all DOM manipulation.
* Wrap complex logic in `try...catch`.
* All state in JS variables — no storage APIs.
* Self-contained — no external fetches, no `window.parent` access.
* Clean, readable code with comments for major sections.

---

Generate a complete, interactive, visually stunning HTML page specifically designed for the data and question provided. Make it feel like a real product, not a demo. Adhere strictly to the HTML code marker format."""


class GenUIRequest(BaseModel):
    question: str
    columns: List[str]
    rows: List[Dict[str, Any]]


# ─────────────────────────────────────────────────────────────────────────────
# Data profiler — gives the model richer context about the data
# ─────────────────────────────────────────────────────────────────────────────
def _is_numeric(v) -> bool:
    try:
        float(v)
        return True
    except (TypeError, ValueError):
        return False


def _profile_data(columns: List[str], rows: List[Dict[str, Any]]) -> str:
    if not rows:
        return "No rows provided."

    profile_lines = [f"Total rows: {len(rows)}", f"Columns ({len(columns)}): {columns}", ""]

    for col in columns:
        values = [r.get(col) for r in rows if r.get(col) is not None]
        if not values:
            profile_lines.append(f"  {col}: all null")
            continue

        numeric_vals = []
        for v in values:
            try:
                numeric_vals.append(float(v))
            except (TypeError, ValueError):
                pass

        if len(numeric_vals) > len(values) * 0.8:
            mn  = min(numeric_vals)
            mx  = max(numeric_vals)
            avg = sum(numeric_vals) / len(numeric_vals)
            profile_lines.append(
                f"  {col}: NUMERIC — min={mn:.2f}, max={mx:.2f}, avg={avg:.2f}, count={len(numeric_vals)}"
            )
        else:
            str_vals = [str(v) for v in values]
            unique   = list(dict.fromkeys(str_vals))
            sample   = unique[:8]
            profile_lines.append(
                f"  {col}: CATEGORICAL — {len(unique)} unique values, sample: {sample}"
            )

    return "\n".join(profile_lines)


def _infer_app_hint(columns: List[str], rows: List[Dict[str, Any]]) -> str:
    if not rows:
        return ""

    col_lower = [c.lower() for c in columns]
    hints     = []

    # Time-series detection
    time_keywords = ["date", "time", "year", "month", "day", "timestamp", "period", "quarter", "week"]
    if any(any(kw in c for kw in time_keywords) for c in col_lower):
        hints.append(
            "TIME-SERIES DATA DETECTED: Build a line chart with zoom/pan, moving average toggle, "
            "and date range selector. Use chartjs-adapter-luxon for time axes."
        )

    # Geographic detection
    geo_keywords = ["lat", "lng", "longitude", "latitude", "country", "city", "region", "state", "zip", "geo"]
    if any(any(kw in c for kw in geo_keywords) for c in col_lower):
        hints.append(
            "GEOGRAPHIC DATA DETECTED: Build a map visualization (SVG choropleth or bubble map). "
            "Do NOT just make a bar chart."
        )

    # Network/relationship detection
    if any(c in col_lower for c in ["source", "target", "from", "to", "edge", "node", "link"]):
        hints.append(
            "NETWORK DATA DETECTED: Build a D3 force-directed graph with draggable nodes and a detail panel."
        )

    # Text/review detection
    text_keywords = ["review", "comment", "text", "description", "feedback", "note", "message", "body", "content"]
    if any(any(kw in c for kw in text_keywords) for c in col_lower):
        hints.append(
            "TEXT DATA DETECTED: Build a card feed with search/filter, sentiment color-coding, "
            "and a word-frequency chart."
        )

    # Ranking detection
    rank_keywords = ["rank", "score", "rating", "position", "place", "standing", "points"]
    if any(any(kw in c for kw in rank_keywords) for c in col_lower):
        hints.append(
            "RANKING DATA DETECTED: Build an animated leaderboard with podium display for top-3 and rank bars."
        )

    # Multi-numeric detection
    numeric_col_count = sum(
        1 for col in columns
        if sum(1 for r in rows[:20] if _is_numeric(r.get(col))) > len(rows[:20]) * 0.6
    )
    if numeric_col_count >= 3 and not hints:
        hints.append(
            "MULTI-NUMERIC DATA DETECTED: Build a dashboard with KPI summary cards (animated counters), "
            "a multi-series chart with toggleable series, and a searchable sortable table."
        )

    if not hints:
        hints.append(
            "GENERAL TABULAR DATA: Build a smart dashboard with summary stat cards, the best-fit chart "
            "for this data (NOT just a bar chart — think carefully about what visualization reveals the most "
            "insight), and a searchable/sortable/filterable data table."
        )

    return "\n".join(hints)


# ─────────────────────────────────────────────────────────────────────────────
# HTML validator — checks if generated HTML is usable
# ─────────────────────────────────────────────────────────────────────────────
def _is_valid_html(html: str) -> bool:
    """Returns True if the HTML looks complete and usable."""
    return (
        "<!DOCTYPE html>" in html and
        "</html>" in html and
        "<body" in html and
        len(html) > 500
    )


def _clean_html(html: str) -> str:
    """Strip markdown fences and inject missing libraries."""
    # Strip markdown fences
    if "```html" in html:
        html = html.split("```html")[-1].split("```")[0].strip()
    elif html.startswith("```"):
        html = html.split("```")[1].split("```")[0].strip()

    # Inject Chart.js if canvas used but missing
    if "<canvas" in html and "chart.js" not in html.lower():
        html = html.replace(
            "</head>",
            '<script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>\n</head>',
            1,
        )

    # Inject Tailwind if missing
    if "tailwindcss" not in html:
        html = html.replace(
            "</head>",
            '<script src="https://cdn.tailwindcss.com"></script>\n</head>',
            1,
        )

    return html


# ─────────────────────────────────────────────────────────────────────────────
# Route
# ─────────────────────────────────────────────────────────────────────────────
@router.post("/generate")
def generate_ui(req: GenUIRequest):
    try:
        api_key = os.environ["GEMINI_API_KEY"]
        client  = genai.Client(api_key=api_key)

        current_date = datetime.now().strftime("%B %d, %Y %H:%M")
        data_preview = json.dumps(req.rows[:75], default=str)
        data_profile = _profile_data(req.columns, req.rows)
        app_hint     = _infer_app_hint(req.columns, req.rows)

        full_prompt = f"""
## Current Request

**Date:** {current_date}

**User's question:** "{req.question}"

---

## Data Profile (auto-analyzed)

{data_profile}

---

## App Type Recommendation (based on data analysis)

{app_hint}

---

## Full Data

**Columns:** {req.columns}

**Total rows:** {len(req.rows)}

**Data (up to 75 rows):**
{data_preview}

---

## Your Task

Build a fully interactive HTML application for this data. The app MUST:
1. Match the recommended app type above (or choose a better-fitting one)
2. NOT default to a plain bar chart unless the data is purely simple categorical counts
3. Include at least 3 meaningful interactive features (filters, toggles, zoom, search, sort, etc.)
4. Include animated loading / entrance animations
5. Show a data table in addition to any charts
6. Be visually polished with a consistent color theme

Return ONLY the raw HTML enclosed in ```html ... ``` markers. Nothing else.
"""

        # ── Retry loop: try up to 3 times if HTML is broken ──────────────
        html = ""
        last_error = ""

        for attempt in range(3):
            try:
                resp = client.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=[full_prompt],
                    config={
                        "temperature": 0.3,        # low = consistent, less random
                        "max_output_tokens": 4096, # limits length = faster
                    }
                )
                raw = (resp.text or "").strip()
                cleaned = _clean_html(raw)

                if _is_valid_html(cleaned):
                    html = cleaned
                    break
                else:
                    last_error = f"Attempt {attempt+1}: HTML validation failed (incomplete output)"

            except Exception as e:
                last_error = f"Attempt {attempt+1}: {str(e)}"
                continue

        if not html:
            raise HTTPException(
                status_code=500,
                detail=f"Failed to generate valid HTML after 3 attempts. Last error: {last_error}"
            )

        return {"html": html}

    except HTTPException:
        raise
    except KeyError:
        raise HTTPException(status_code=500, detail="GEMINI_API_KEY environment variable not set.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))