FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ee_pipeline.py main.py ./
COPY data ./data

# Cloud Run sets $PORT; no EE_SERVICE_ACCOUNT_KEY here on purpose — the service
# authenticates to Earth Engine as its own runtime service account (see ee_pipeline.init_ee).
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8080}"]
