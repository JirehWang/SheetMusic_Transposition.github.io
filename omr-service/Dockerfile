FROM ubuntu:24.04

ARG AUDIVERIS_DEB_URL=https://github.com/Audiveris/audiveris/releases/download/5.10.2/Audiveris-5.10.2-ubuntu24.04-x86_64.deb

ENV DEBIAN_FRONTEND=noninteractive
ENV PORT=8080
ENV AUDIVERIS_TIMEOUT_SECONDS=180

RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    fonts-dejavu \
    ghostscript \
    openjdk-21-jre-headless \
    python3 \
    python3-pip \
    python3-venv \
    tesseract-ocr \
    tesseract-ocr-chi-tra \
    tesseract-ocr-eng \
    unzip \
  && rm -rf /var/lib/apt/lists/*

RUN curl -L "$AUDIVERIS_DEB_URL" -o /tmp/audiveris.deb \
  && apt-get update \
  && apt-get install -y /tmp/audiveris.deb \
  && rm -f /tmp/audiveris.deb \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN python3 -m venv /venv \
  && /venv/bin/pip install --no-cache-dir -r requirements.txt

COPY app.py .

EXPOSE 8080

CMD ["/bin/sh", "-c", "/venv/bin/uvicorn app:app --host 0.0.0.0 --port ${PORT}"]
