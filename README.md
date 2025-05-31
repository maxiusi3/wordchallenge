# 单词闯关 - 在线英语学习游戏

🎮 **一个互动式的英语单词学习游戏，支持单人闯关和在线双人对战！**

🌐 **在线体验**: [https://maxiusi3.github.io/wordchallenge/](https://maxiusi3.github.io/wordchallenge/)

## 🎆 游戏特色

### 🏆 双模式游戏体验
- **📚 单人闯关模式**: 逐关挑战，稳步提升
- **⚔️ 在线对战模式**: 与真实玩家实时对战，竞技互动

### 🎯 三大游戏关卡
1. **🇨🇳→🇬🇧 中译英**: 根据中文释义输入英文单词
2. **🇬🇧→🇨🇳 英译中**: 根据英文单词选择中文释义
3. **🎧 听写练习**: 根据音频输入正确的英文单词

### 🎮 双人对战小游戏
- **🚔 警察抓小偷**: 第一关的追逐游戏
- **🏗️ 登天梯竞赛**: 第二关的攀爬挑战
- **🤜 词力拔河**: 第三关的力量对决

### 📊 学习功能
- **🎧 智能语音**: 内置 TTS 音频播放
- **📊 进度跟踪**: 实时显示学习进度
- **📈 错题复习**: 自动收集错题供复习
- **🏆 成就系统**: 完成挑战获得成就

### 📱 技术特性
- **📱 响应式设计**: 完美支持手机、平板和PC
- **🌐 在线对战**: 基于Socket.IO的实时通信
- **💾 本地存储**: 支持离线游戏和数据缓存
- **🎨 精美界面**: 现代化设计，流畅动画

## 🚀 快速开始

### 🌐 在线体验
直接访问: **[https://maxiusi3.github.io/wordchallenge/](https://maxiusi3.github.io/wordchallenge/)**

### 💻 本地部署

```bash
# 克隆仓库
git clone https://github.com/maxiusi3/wordchallenge.git
cd wordchallenge

# 使用本地服务器打开
python -m http.server 8000
# 或者
npx serve .

# 访问 http://localhost:8000
```

## 🎮 游戏玩法

### 📚 单人闯关模式
1. 输入你的昵称和年级
2. 逐关挑战，每关都有不同的游戏方式
3. 完成所有关卡获得最终成绩

### ⚔️ 在线对战模式
1. 输入你的昵称、年级和头像
2. 系统自动匹配同年级的对手
3. 与对手实时竞技，争夺胜利
4. 三局两胜制，每关都有独特的小游戏

## 📚 词库资源

游戏包含丰富的词库资源：
- **小学阶段**: 3-6年级词汇
- **初中阶段**: 7-9年级词汇
- **高中阶段**: 高频词汇和全部词汇

所有词汇都经过精心筛选，符合各年级学习标准。

## 🛠️ 技术栈

- **前端框架**: 原生 HTML5 + CSS3 + JavaScript (ES6+)
- **UI 框架**: Tailwind CSS
- **图标库**: Lucide Icons
- **音频处理**: Web Audio API + Edge TTS
- **实时通信**: Socket.IO (在线对战)
- **数据存储**: LocalStorage + JSON

## 📁 项目结构

```
wordchallenge/
├── index.html              # 主入口文件
├── css/
│   └── style.css           # 主样式文件
├── js/
│   ├── main.js             # 单人游戏主逻辑
│   ├── battle-manager.js   # 双人对战管理
│   ├── websocket-client.js # 在线通信客户端
│   ├── audio.js            # 音频处理
│   └── navigation.js       # 页面导航
├── screens/
│   ├── welcome.html        # 欢迎页面
│   ├── info_input.html     # 用户信息输入
│   ├── level1.html         # 单人第一关
│   ├── level2.html         # 单人第二关
│   ├── level3.html         # 单人第三关
│   ├── battle_*.html       # 双人对战页面
│   └── result_*.html       # 结果页面
├── data/
│   └── renjiaoban/         # 人教版词库数据
└── audio/
    └── *.wav               # 游戏音效文件
```

## 🌟 更新日志

### v2.0.0 - 在线对战版本
- ✨ 新增在线双人对战模式
- 🎮 三个独特的对战小游戏
- 🔄 实时匹配系统
- 🎨 全新的界面设计
- 📊 完善的数据统计

### v1.0.0 - 基础版本
- 📚 单人闯关模式
- 🎧 音频播放功能
- 📊 进度跟踪系统
- 📱 响应式设计

## 🤝 贡献指南

欢迎参与项目开发！

1. **Fork** 这个仓库
2. 创建你的特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交你的修改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开一个 **Pull Request**

## 📝 许可证

该项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📧 联系方式

- **GitHub Issues**: [问题反馈](https://github.com/maxiusi3/wordchallenge/issues)
- **项目作者**: @maxiusi3

---

🎆 **立即开始你的英语学习之旅！** [https://maxiusi3.github.io/wordchallenge/](https://maxiusi3.github.io/wordchallenge/)
