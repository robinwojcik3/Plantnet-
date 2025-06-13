FROM python:3.11-slim
WORKDIR /app
COPY "./PCA Habitat/requirements.txt" .
RUN pip install --no-cache-dir -r requirements.txt
COPY "./PCA Habitat/" /app/
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
