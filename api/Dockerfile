# Team Behavior Ranking API (FastAPI + psycopg).
# Build context = project root (WebApp_Behavior_Ranking) so it can copy scripts/agg_core.py.
#   docker build -f api/Dockerfile -t ww-tt-api .
FROM python:3.12-slim

WORKDIR /app
COPY api/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# shared aggregation logic (single source of truth with the Excel pipeline) + the app
COPY scripts/agg_core.py /app/scripts/agg_core.py
COPY api/main.py /app/main.py

EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD python -c "import urllib.request,sys; sys.exit(0 if urllib.request.urlopen('http://localhost:8000/healthz').status==200 else 1)" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
