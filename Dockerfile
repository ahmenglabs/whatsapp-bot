FROM ubuntu:24.04

RUN apt-get update && apt-get install -y \
    curl \
    ffmpeg

RUN curl -fsSL https://deb.nodesource.com/setup_23.x -o nodesource_setup.sh && \
    bash nodesource_setup.sh && \
    apt-get install -y nodejs

RUN mkdir -p /app/.wwebjs_auth /app/.wwebjs_cache

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

ENV FFMPEG_PATH=/usr/bin/ffmpeg

VOLUME ["/app/.wwebjs_auth", "/app/.wwebjs_cache"]

CMD ["npm", "start"]