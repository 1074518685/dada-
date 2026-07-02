# 座位预选

一个可部署到 GitHub Pages 的静态座位选择页面。

- 三张圆桌呈三角形排列
- 每张圆桌 8 个座位，共 24 个座位
- 输入姓名后可选择座位并锁定
- 锁定状态保存在当前浏览器的 `localStorage`
- 支持桌面和手机浏览器

## GitHub Pages 发布

1. 将本目录推送到 GitHub 仓库。
2. 在仓库设置中打开 `Pages`。
3. Source 选择 `Deploy from a branch`。
4. Branch 选择 `main`，目录选择 `/root`。
5. 保存后等待 GitHub Pages 生成公开访问链接。

## 注意

这是纯静态页面。GitHub Pages 不提供共享数据库，所以座位锁定状态不会自动同步给其他用户。
如果要多人实时抢座和防重复锁定，需要接入 Supabase、Firebase、Vercel Serverless 等后端服务。
