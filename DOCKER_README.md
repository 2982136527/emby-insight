# Emby Insight - Docker 部署指南

![Dashboard Preview](https://github.com/2982136527/emby-insight/blob/main/public/dashboard-preview.png?raw=true)

**Emby Insight** 是一个专为 Emby 媒体服务器设计的现代化数据分析与监控面板。
本项目现已提供 Docker 镜像，方便您在各大平台（Unraid, Synology, TrueNAS, VPS 等）快速部署。

> 请注意：图片预览可能需要访问 GitHub。

## 🚀 快速启动 (Docker CLI)

使用以下命令即可快速启动容器：

```bash
docker run -d \
  --name emby-insight \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -v /你的宿主机/媒体/目录:/media \
  -e DATABASE_URL="file:/app/data/dev.db" \
  -e TMDB_DATABASE_URL="file:/app/data/tmdb.db" \
  qiuhusama/emby-insight:latest
```

## 🐳 使用 Docker Compose (推荐)

在您的项目目录中创建 `docker-compose.yml` 文件：

```yaml
version: '3'

services:
  emby-insight:
    image: qiuhusama/emby-insight:latest
    container_name: emby-insight
    restart: always
    ports:
      - "3000:3000"
    volumes:
      - ./data:/app/data
      # 映射媒体库目录，方便刮削器扫描 (例如将宿主机的 /Volumes 映射到容器的 /media)
      # 务必确保容器内的路径与您在 Emby Insight 设置中填写的“库路径”一致
      - /path/to/your/media:/media
    environment:
      - DATABASE_URL=file:/app/data/dev.db
      - TMDB_DATABASE_URL=file:/app/data/tmdb.db
```

然后运行：
```bash
docker-compose up -d
```

## 📂 数据持久化

1. **数据库**: 容器内的 `/app/data` 目录用于存储 SQLite 数据库文件 (`dev.db` 和 `tmdb.db`)。**务必**将此目录映射到宿主机。
2. **媒体库**: 为了使用“智能刮削器”功能，您需要将宿主机的媒体文件夹映射到容器内部（推荐映射到 `/media` 或与其在宿主机一致的路径），以便应用能读取文件。

## 🛠️ 环境变量

| 变量名 | 默认值 | 说明 |
| :--- | :--- | :--- |
| `DATABASE_URL` | `file:/app/data/dev.db` | 主数据库连接字符串，Docker 部署时请保持指向持久化卷中的路径。 |
| `TMDB_DATABASE_URL` | `file:/app/data/tmdb.db` | TMDB 缓存数据库，用于存储刮削元数据。 |
| `PORT` | `3000` | 应用监听端口。 |

## ✨ 核心功能预览

*   **全能仪表盘**: 实时概览、趋势分析、服务器分布。
*   **高级用户管理**: 跨服务器用户聚合、全局账号管理。
*   **深度画像**: 观看习惯热力图、内容偏好分析、设备统计。
*   **实时监控**: 查看当前活跃会话与详细转码信息。
*   **排行榜**: 真正的“卷王”榜单。

---

更多详情与源码请访问 GitHub: [https://github.com/2982136527/emby-insight](https://github.com/2982136527/emby-insight)
