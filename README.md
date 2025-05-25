# 🎮 单词闯关游戏

一个有趣的英语单词学习游戏，支持多个年级的词汇练习，包含听力、选择和拼写三种游戏模式。

## 🌟 特性

- 🎯 **三种游戏模式**：看中文选英文、看英文选中文、听音写单词
- 📚 **多年级支持**：小学3-6年级、初中7-9年级、高中词汇
- 🔊 **语音功能**：真人发音，支持TTS文本转语音
- 📱 **响应式设计**：完美支持手机、平板和电脑
- 🎨 **精美界面**：现代化设计，流畅的动画效果
- ⚙️ **管理员系统**：可配置游戏参数和难度

## 🚀 在线体验

### 🎮 [开始游戏](https://maxiusi3.github.io/wordchallenge/)

### 🔍 [检查网络状态](https://maxiusi3.github.io/wordchallenge/online-status.html)

## 📱 支持的设备

- ✅ iPhone/iPad (Safari)
- ✅ Android 手机/平板 (Chrome)
- ✅ Windows/Mac 电脑 (Chrome, Firefox, Safari, Edge)
- ✅ 其他现代浏览器

## 🎯 游戏模式

### 第一关：看中文选英文
- 显示中文词汇，从4个英文选项中选择正确答案
- 15秒时间限制，3次尝试机会
- 适合词汇认知训练

### 第二关：看英文选中文
- 显示英文词汇，从4个中文选项中选择正确答案
- 无时间限制，3次尝试机会
- 适合理解能力训练

### 第三关：听音写单词
- 听英文发音，输入正确的英文单词
- 15秒时间限制，3次尝试机会
- 适合听力和拼写训练

## 📊 年级词库

| 年级 | 词汇量 | 难度 |
|------|--------|------|
| 小学3年级 | ~200词 | ⭐ |
| 小学4年级 | ~300词 | ⭐⭐ |
| 小学5年级 | ~400词 | ⭐⭐ |
| 小学6年级 | ~500词 | ⭐⭐⭐ |
| 初中7年级 | ~600词 | ⭐⭐⭐ |
| 初中8年级 | ~700词 | ⭐⭐⭐⭐ |
| 初中9年级 | ~800词 | ⭐⭐⭐⭐ |
| 高中高频词 | ~1000词 | ⭐⭐⭐⭐⭐ |
| 高中全部词汇 | ~3000词 | ⭐⭐⭐⭐⭐ |

## 🛠️ 技术栈

- **前端**: HTML5, CSS3, JavaScript (ES6+)
- **样式**: Tailwind CSS
- **图标**: Lucide Icons
- **音频**: Web Audio API, Speech Synthesis API
- **部署**: GitHub Pages

## 🔧 本地开发

1. **克隆仓库**
   ```bash
   git clone https://github.com/maxiusi3/wordchallenge.git
   cd wordchallenge
   ```

2. **启动本地服务器**
   ```bash
   # 使用Python
   python -m http.server 8000

   # 或使用Node.js
   npx serve .

   # 或使用PHP
   php -S localhost:8000
   ```

3. **访问游戏**
   ```
   http://localhost:8000
   ```

## 📁 项目结构

```
wordchallenge/
├── index.html              # 主游戏页面
├── online-status.html      # 网络状态检查
├── css/
│   └── style.css          # 样式文件
├── js/
│   ├── main.js            # 主游戏逻辑
│   ├── audio.js           # 音频管理
│   └── network-manager.js # 网络管理
├── screens/               # 游戏界面
├── data/renjiaoban/       # 题库数据
├── audio/                 # 音效文件
└── icons/                 # 图标文件
```

## ⚙️ 管理员功能

游戏包含管理员系统，可以配置：
- 每关题目数量
- 目标分数
- 时间限制
- 难度设置

**访问方式**: 点击欢迎页面右上角的设置图标

## 🌐 部署指南

详细的部署说明请参考 [DEPLOYMENT.md](./DEPLOYMENT.md)

支持多种部署方式：
- GitHub Pages (推荐)
- Netlify
- Vercel
- 静态文件服务器

## 🐛 问题反馈

如果您在使用过程中遇到问题，请：

1. 首先访问 [网络状态检查页面](https://maxiusi3.github.io/wordchallenge/online-status.html)
2. 检查浏览器控制台是否有错误信息
3. 在 [Issues](https://github.com/maxiusi3/wordchallenge/issues) 页面提交问题

## 📄 开源协议

本项目采用 MIT 协议开源，详见 [LICENSE](./LICENSE) 文件。

## 🙏 致谢

- 题库数据基于人教版英语教材
- 图标来自 [Lucide Icons](https://lucide.dev/)
- 样式框架 [Tailwind CSS](https://tailwindcss.com/)

---

## 🎯 快速开始

1. 点击 [开始游戏](https://maxiusi3.github.io/wordchallenge/)
2. 输入昵称和选择年级
3. 开始第一关挑战
4. 享受学习英语的乐趣！

**祝您游戏愉快！** 🎉
