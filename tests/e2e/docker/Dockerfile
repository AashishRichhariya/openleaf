# The e2e runner: Playwright's browsers, the repo's Node and pnpm. Nothing from the repo is baked in:
# run.sh hands the working tree to each run, without env files.
# The tag must match @playwright/test in package.json. Bump both together.
FROM mcr.microsoft.com/playwright:v1.65.1-noble@sha256:1507cbfc550a63a6b7396791ca4f00df17beb56342d2447b3f106c306f525579

ARG NODE_VERSION=26.13.1
ARG PNPM_VERSION=12.21.0

ENV DEBIAN_FRONTEND=noninteractive \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright \
    NEXT_TELEMETRY_DISABLED=1

RUN apt-get update \
 && apt-get install -y --no-install-recommends ca-certificates curl git xz-utils \
 && rm -rf /var/lib/apt/lists/*

# Node from the official tarball for this architecture, checked against its published sha256.
RUN set -eu; \
    case "$(dpkg --print-architecture)" in \
      amd64) arch=x64 ;; arm64) arch=arm64 ;; *) echo "unsupported architecture" >&2; exit 1 ;; \
    esac; \
    file="node-v${NODE_VERSION}-linux-${arch}.tar.xz"; \
    cd /tmp; \
    curl -fsSLO "https://nodejs.org/dist/v${NODE_VERSION}/${file}"; \
    curl -fsSL "https://nodejs.org/dist/v${NODE_VERSION}/SHASUMS256.txt" | grep " ${file}\$" | sha256sum -c -; \
    tar -xJf "${file}" -C /usr/local --strip-components=1 --no-same-owner; \
    rm "${file}"; \
    test "$(node -v)" = "v${NODE_VERSION}"

# Node 25 and later ship without corepack.
RUN npm install -g "pnpm@${PNPM_VERSION}" && test "$(pnpm -v)" = "${PNPM_VERSION}"

COPY inner.sh create-table.mjs /opt/e2e/
WORKDIR /work
