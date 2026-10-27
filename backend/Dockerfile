FROM python:3.12-slim
COPY --from=ghcr.io/astral-sh/uv:0.9.7 /uv /usr/local/bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --locked --no-dev
COPY agents.py main.py ./
ENV PORT=8080
CMD ["sh", "-c", "uv run --locked uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
