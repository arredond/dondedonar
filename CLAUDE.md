# CLAUDE.md

## Running Python

Always use `uv run` for Python commands:

```bash
uv run python main.py
uv run python -m pytest etl/tests/
uv run ruff format etl/
uv run ruff check etl/
```

## Running the app locally

Always start and stop the frontend dev server with the helper script, never `npm run dev` directly:

```bash
bin/dondedonar start   # Vite in the background on all interfaces (LAN-reachable); prints the URLs
bin/dondedonar stop
```

It keeps its PID and log in `.dondedonar/` (gitignored); check `.dondedonar/dev.log` if the server misbehaves.

## Checks

`pre-commit` runs these on every commit (install once with `uv run pre-commit install`; run all with `uv run pre-commit run --all-files`):

- Python: `uv run ruff format`, `uv run ruff check`, `uv run pyrefly check` (no baseline; keep it at zero errors). For BeautifulSoup lookups and regex matches the page guarantees, use `crawl.required(...)`; for attribute values, `crawl.attribute(tag, name)`. For row-wise maps that may return None, use `points.apply_rows(df, func)` (pandas' type hints reject None-returning `df.apply(..., axis=1)`).
- Frontend (from `frontend/`): `npm run format` (prettier), `npm run lint` (oxlint, warnings fail), `npm run typecheck` (tsc over the JS via `checkJs`; use JSDoc for types).

## Code style

- All code, variable names, function names, and docstrings must be in English.
- No private functions (no leading `_`) outside of test files.
- Import submodules directly rather than importing symbols from them:
  ```python
  # good
  from utils import crawl

  crawl.scrape_fixed_points()

  # avoid
  from utils.crawl import scrape_fixed_points
  ```
- No variable aliases for DataFrames — use the original name or reassign in place.
- Prefer `pd.read_json` / `pd.read_csv` over `open` + `json.load` when loading data files into DataFrames.

## ETL / database

- The ETL is a single callable function (`run_etl`) designed to run as a Cloud Run job. Keep it that way.
- It is fine to drop and recreate DB tables entirely on each run. Do not add migration logic or column-mapping tracking tables.
- Exception: `blood_levels` is append-only to keep a history of reserve levels. The ETL calls `to_db(..., if_exists="append")`; the table is created by hand via `sql/create_blood_levels_table.sql`.
- One module per region in `etl/regions/<region>.py` (its `REGION` name and `scrape_fixed_points()`, plus `scrape_mobile_points()` / `scrape_blood_levels()` where its source has them), registered in `main.REGIONS`. Raw page parsing lives in `etl/utils/crawl/<region>.py`; logic shared across regions goes in `etl/utils/` (`geocode.py`, `points.py`, `opening_hours.py`), not in a region module.
- Every output table carries a `region` column (Comunidad Autónoma), stamped from each region module's `REGION` constant.
- The geocoding cache is stored in the DB and must be checked before any Google Maps API call to avoid redundant spend. Collect all unique addresses across all address fields first, subtract the cached set, then geocode only the remainder.

## Tests

- Run with `uv run python -m pytest etl/tests/`.
- Mock HTTP calls with `responses` and Google Maps client calls via `mocker.patch("googlemaps.Client", ...)`.
- Private helper functions (e.g. `_make_row`) are acceptable inside test files for simple setup logic.
