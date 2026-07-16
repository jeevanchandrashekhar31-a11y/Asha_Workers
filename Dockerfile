FROM node:20-slim
WORKDIR /usr/src/app
RUN apt-get update -y && apt-get install -y openssl
COPY . ./
RUN npm ci --only=production
CMD [ "npm", "start" ]
