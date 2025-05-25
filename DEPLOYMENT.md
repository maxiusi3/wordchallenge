# 单词闯关游戏 - 在线版本部署指南

## 🌐 概述

本游戏已改造为纯在线版本，移除了所有离线功能和PWA特性，专注于提供稳定的在线游戏体验。

## 📁 文件结构

```
单词闯关/
├── index.html                 # 主游戏页面
├── online-status.html         # 在线状态检查页面
├── css/
│   └── style.css             # 样式文件
├── js/
│   ├── main.js               # 主游戏逻辑
│   ├── audio.js              # 音频管理
│   └── network-manager.js    # 网络状态管理
├── screens/                  # 游戏界面
│   ├── welcome.html
│   ├── info_input.html
│   ├── level1.html
│   ├── level2.html
│   ├── level3.html
│   ├── result.html
│   ├── result_success.html
│   ├── result_failure.html
│   ├── admin_login.html
│   └── admin_config.html
├── data/renjiaoban/          # 题库数据
│   ├── grade3.json
│   ├── grade4.json
│   ├── grade5.json
│   ├── grade6.json
│   ├── grade7.json
│   ├── grade8.json
│   ├── grade9.json
│   ├── highschool_high_freq.json
│   └── highschool_all.json
├── audio/                    # 音效文件
│   ├── click.wav
│   ├── correct.wav
│   ├── incorrect.wav
│   └── ...
└── icons/                    # 图标文件
    ├── icon-192x192.png
    └── icon-512x512.png
```

## 🚀 部署方式

### 方式一：静态文件服务器

1. **上传文件**
   - 将整个项目文件夹上传到Web服务器
   - 确保所有文件路径保持相对路径结构

2. **服务器配置**
   - 确保服务器支持静态文件服务
   - 配置正确的MIME类型：
     ```
     .json -> application/json
     .wav  -> audio/wav
     .html -> text/html
     .css  -> text/css
     .js   -> application/javascript
     ```

3. **访问游戏**
   - 直接访问：`https://yourdomain.com/index.html`
   - 状态检查：`https://yourdomain.com/online-status.html`

### 方式二：GitHub Pages

1. **创建仓库**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/username/word-challenge.git
   git push -u origin main
   ```

2. **启用GitHub Pages**
   - 进入仓库设置
   - 找到Pages选项
   - 选择源分支（通常是main）
   - 保存设置

3. **访问游戏**
   - 游戏地址：`https://username.github.io/word-challenge/`

### 方式三：Netlify部署

1. **拖拽部署**
   - 访问 [Netlify](https://netlify.com)
   - 直接拖拽项目文件夹到部署区域

2. **Git集成**
   - 连接GitHub仓库
   - 自动部署和更新

### 方式四：Vercel部署

1. **安装Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **部署**
   ```bash
   cd 单词闯关
   vercel
   ```

## ⚙️ 服务器要求

### 最低要求
- 支持静态文件服务
- 支持HTTPS（推荐）
- 带宽：1MB/s以上

### 推荐配置
- CDN加速
- Gzip压缩
- 缓存策略：
  ```
  HTML文件：no-cache
  CSS/JS文件：1天
  音频文件：7天
  题库JSON：1小时
  ```

## 🔧 配置选项

### 网络超时设置
在 `js/network-manager.js` 中可以调整：
```javascript
signal: AbortSignal.timeout(10000) // 10秒超时
```

### 重试次数
```javascript
async fetchWithRetry(url, options = {}, maxRetries = 3)
```

### 题库路径
在 `js/main.js` 中的 `loadQuestionsForGrade` 函数中修改：
```javascript
primaryPath = 'data/renjiaoban/grade3.json';
```

## 📱 移动端优化

游戏已针对移动端进行优化：
- 响应式设计
- 触摸友好的界面
- iPad专门优化
- 自适应字体大小

## 🔍 故障排除

### 常见问题

1. **题库加载失败**
   - 检查JSON文件路径
   - 确认文件格式正确
   - 查看浏览器控制台错误

2. **音频播放问题**
   - 确保音频文件存在
   - 检查浏览器自动播放策略
   - 用户需要先交互才能播放音频

3. **网络连接问题**
   - 使用 `online-status.html` 检查状态
   - 确认服务器可访问性
   - 检查CORS设置

### 调试工具

1. **浏览器开发者工具**
   - Console：查看错误日志
   - Network：检查资源加载
   - Application：查看存储状态

2. **在线状态检查页面**
   - 访问 `online-status.html`
   - 查看详细的连接状态
   - 测试各项功能

## 📊 性能优化

### 已实现的优化
- 移除了Service Worker和缓存机制
- 简化了数据加载逻辑
- 优化了网络请求重试机制
- 添加了加载指示器

### 进一步优化建议
1. **压缩资源**
   - 压缩CSS和JavaScript文件
   - 优化图片和音频文件大小

2. **CDN加速**
   - 使用CDN分发静态资源
   - 就近访问提高加载速度

3. **预加载关键资源**
   - 预加载常用题库
   - 预加载音效文件

## 🔒 安全考虑

1. **HTTPS部署**
   - 强制使用HTTPS
   - 保护用户数据传输

2. **内容安全策略**
   - 配置CSP头部
   - 防止XSS攻击

3. **访问控制**
   - 管理员功能密码保护
   - 限制敏感操作

## 📈 监控和分析

### 推荐工具
- Google Analytics：用户行为分析
- Sentry：错误监控
- Lighthouse：性能评估

### 关键指标
- 页面加载时间
- 题库加载成功率
- 用户完成率
- 错误发生频率

## 🆕 更新和维护

### 题库更新
1. 修改对应的JSON文件
2. 重新部署到服务器
3. 清除浏览器缓存

### 功能更新
1. 修改相应的HTML/CSS/JS文件
2. 测试所有功能
3. 部署新版本

### 版本管理
- 使用Git进行版本控制
- 为每个版本打标签
- 保留回滚能力

---

## 📞 技术支持

如果在部署过程中遇到问题，请检查：
1. 浏览器控制台错误信息
2. 网络连接状态
3. 服务器配置
4. 文件路径和权限

游戏现在是纯在线版本，需要稳定的网络连接才能正常运行。
