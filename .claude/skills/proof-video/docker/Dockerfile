# Everything /proof-video needs, pinned, so the same storyboard gives the same narration on any machine.
# Playwright's image already has Node 26.13.1 (the repo's Volta pin), Python 3.12 and git.
FROM mcr.microsoft.com/playwright:v1.65.1-noble

ENV DEBIAN_FRONTEND=noninteractive \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

# ffmpeg with libass and x264, for muxing, captions and frames.
RUN apt-get update \
 && apt-get install -y --no-install-recommends ffmpeg python3-venv curl \
 && rm -rf /var/lib/apt/lists/*

# Text to speech (Kokoro) and speech to text (Whisper), in their own venv.
COPY docker/requirements.txt /opt/requirements.txt
RUN python3 -m venv /opt/venv \
 && /opt/venv/bin/pip install --no-cache-dir -r /opt/requirements.txt
ENV PATH=/opt/venv/bin:$PATH

# Kokoro v1.0 model files (Apache-2.0), checked by sha256.
RUN mkdir -p /opt/models/kokoro && cd /opt/models/kokoro \
 && curl -fsSL -o kokoro-v1.0.onnx https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx \
 && curl -fsSL -o voices-v1.0.bin https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin \
 && echo "7d5df8ecf7d4b1878015a32686053fd0eebe2bc377234608764cc0ef3636a6c5  kokoro-v1.0.onnx" | sha256sum -c - \
 && echo "bca610b8308e8d99f32e6fe4197e7ec01679264efed0cac9140fe9c29f1fbf7d  voices-v1.0.bin" | sha256sum -c -

# Whisper base.en (MIT), at a fixed revision.
ARG WHISPER_REVISION=3d3d5dee26484f91867d81cb899cfcf72b96be6c
RUN python3 -c "from huggingface_hub import snapshot_download; snapshot_download('Systran/faster-whisper-base.en', revision='${WHISPER_REVISION}', local_dir='/opt/models/whisper-base.en')"

# pnpm for building openleaf, and the Playwright client for the recorder.
RUN npm install -g pnpm@12.21.0 \
 && mkdir -p /opt/pv && cd /opt/pv && npm init -y >/dev/null && npm install --no-audit --no-fund playwright@1.65.1

COPY scripts/ /opt/pv/
WORKDIR /opt/pv
