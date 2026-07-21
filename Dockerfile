FROM mcr.microsoft.com/playwright:v1.58.2-noble

WORKDIR /app

# Install npm dependencies (cached layer — rebuilt only when lockfile changes)
COPY package*.json ./
RUN npm ci --ignore-scripts

# Copy only what the tests need
COPY playwright.config.ts ./
COPY tests/ ./tests/

CMD ["npx", "playwright", "test"]
