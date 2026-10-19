FROM node:24-bookworm-slim AS web
WORKDIR /web
COPY frontend/package.json ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run typecheck && npm run build
RUN npm install --no-save --no-audit --no-fund playwright && npx playwright install --with-deps chromium && node tests/ui-smoke.mjs

FROM python:3.12-slim-bookworm
WORKDIR /app/backend
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./
RUN python -m pytest -q && DATABASE_URL=sqlite:////tmp/migration-check.db python -m alembic upgrade head
COPY --from=web /usr/local/bin/node /usr/local/bin/node
COPY --from=web /web/.next/standalone /app/web/
COPY --from=web /web/.next/static /app/web/.next/static
COPY deploy/start.py /app/start.py
ENV API_BASE_URL=http://127.0.0.1:8000 NEXT_TELEMETRY_DISABLED=1 HOSTNAME=0.0.0.0
RUN useradd --create-home --uid 10001 ourbit && chown -R ourbit:ourbit /app
USER ourbit
EXPOSE 10000
CMD ["python", "/app/start.py"]
