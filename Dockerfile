# 多阶段构建
FROM node:20-alpine AS builder

WORKDIR /app

# 复制 package 文件
COPY package.json ./
COPY package-lock.json* ./

# 安装依赖
RUN npm install --legacy-peer-deps

# 复制源代码
COPY . .

# 构建
RUN npm run build

# 生产阶段
FROM node:20-alpine

WORKDIR /app

# 复制构建产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/sql ./sql

# 创建上传目录
RUN mkdir -p /app/uploads

# 环境变量
ENV NODE_ENV=production
ENV PORT=3000
ENV UPLOAD_DIR=/app/uploads

# 暴露端口
EXPOSE 3000

# 启动命令
CMD ["node", "dist/server/main.js"]
