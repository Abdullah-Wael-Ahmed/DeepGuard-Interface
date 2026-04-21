FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
# Use a cache mount to speed up pip installs across builds
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt

COPY . .

RUN mkdir -p /app/model /app/data

EXPOSE 5001

CMD ["python", "detector.py"]
