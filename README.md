# 家访材料管理系统（独立版）

一个完全独立的家访材料收集管理平台，不依赖飞书/钉钉等第三方平台。

## 快速开始

详见 [部署指南.md](./部署指南.md)

## 功能特性

- 五级权限：管理员、校级领导、级长、年级主任、班主任
- 班主任只能管理本班数据，互不可见
- 文件上传/下载/在线查看
- 按月份自动汇总三个年级数据
- 三大类别：常规家访、重点关爱学生家访、其他家访
- 四种形式：实地家访、到校家访、电话家访、微信家访
- 一键导入班主任名单和学生名单
- 批量下载附件

## 技术栈

- 前端：React 19 + Vite + TypeScript + Tailwind CSS + Ant Design
- 后端：NestJS 10 + TypeScript
- 数据库：PostgreSQL
- ORM：Drizzle ORM

## 默认账号

- 账号：`admin`
- 密码：`admin123`

## 目录结构

```
home-visit-standalone/
├── client/              # 前端代码
├── server/              # 后端代码
│   ├── modules/         # 业务模块
│   ├── database/        # 数据库模块
│   ├── platform-shim/   # 平台兼容层
│   └── main.ts          # 后端入口
├── shared/              # 共享类型定义
├── sql/                 # 数据库初始化脚本
├── uploads/             # 文件上传目录
├── Dockerfile           # Docker 构建文件
├── render.yaml          # Render 部署配置
├── .env.example         # 环境变量模板
├── package.json         # 项目配置
└── 部署指南.md          # 详细部署说明
```
