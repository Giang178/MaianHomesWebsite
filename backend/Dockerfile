FROM python:3.12.13-slim-bookworm AS runtime
ARG APP_RELEASE=development
LABEL com.maianhomes.capability.activity-worker="true"
LABEL org.opencontainers.image.revision="$APP_RELEASE"
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app/backend
RUN printf '%s\n' "$APP_RELEASE" > /app/.image-revision
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY app ./app
COPY scripts ./scripts
RUN groupadd --system app && useradd --system --gid app --home /app app \
    && mkdir -p uploads/avatars uploads/projects uploads/articles uploads/inventory uploads/consignments \
    && chown -R app:app /app
USER app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "4", "--no-access-log", "--proxy-headers", "--forwarded-allow-ips", "172.16.0.0/12"]
