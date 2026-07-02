# 座位预选

一个可部署到 GitHub Pages 的静态座位选择页面。

- 三张圆桌呈三角形排列
- 每张圆桌 8 个座位，共 24 个座位
- 输入姓名后可选择座位并锁定
- 配置 Firebase 后，所有访问者实时看到同一份锁定状态
- 只有锁定座位的本人可以释放该座位
- 支持桌面和手机浏览器

## 实时锁座配置

GitHub Pages 只能托管静态页面。要让多人共享座位锁定状态，需要启用 Firebase。

1. 创建 Firebase 项目。
2. 启用 Authentication 的 Anonymous 匿名登录。
3. 创建 Firestore Database。
4. 将 `firestore.rules` 里的规则复制到 Firestore Rules 并发布。
5. 在项目设置中创建 Web App，把 Firebase config 填入 `firebase-config.js`。

`firebase-config.js` 示例：

```js
export const firebaseConfig = {
  apiKey: "xxx",
  authDomain: "xxx.firebaseapp.com",
  projectId: "xxx",
  appId: "xxx",
};
```

如果 `firebase-config.js` 为空，页面会进入“本机演示”模式，锁座只保存在当前浏览器。

## GitHub Pages 发布

1. 将本目录推送到 GitHub 仓库。
2. 在仓库设置中打开 `Pages`。
3. Source 选择 `Deploy from a branch`。
4. Branch 选择 `main`，目录选择 `/root`。
5. 保存后等待 GitHub Pages 生成公开访问链接。

## 注意

匿名登录的“本人”按浏览器身份识别。同一个人换浏览器或清除浏览器数据后，会被识别为新用户。
