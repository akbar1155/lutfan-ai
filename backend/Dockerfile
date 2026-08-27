FROM cgr.dev/chainguard/python:latest-dev AS builder

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    VENV_PATH=/app/.venv

COPY requirements.txt /app/requirements.txt
RUN python -m venv "$VENV_PATH" \
    && "$VENV_PATH/bin/pip" install --upgrade pip setuptools wheel \
    && "$VENV_PATH/bin/pip" install -r /app/requirements.txt

COPY . /app

FROM cgr.dev/chainguard/python:latest

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    VENV_PATH=/app/.venv \
    PATH=/app/.venv/bin:$PATH

COPY --from=builder /app /app

# Chainguard runtime image is non-root by default.
