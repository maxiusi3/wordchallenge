# 🎮 单词闯关游戏 v2.1.0

一个支持真实跨设备对战的在线单词学习游戏，专为中小学生设计。

🌐 **在线体验**: [https://maxiusi3.github.io/wordchallenge/](https://maxiusi3.github.io/wordchallenge/)

## ✨ 主要功能

### 🎯 游戏模式
- **双人对战**: 真实跨设备匹配对战
- **智能匹配**: 按年级自动匹配同水平玩家
- **AI对手**: 无法匹配时提供AI助手
- **三关对战**: 警察抓小偷、登天梯、赛车竞速

### 📚 学习内容
- 覆盖小学3-6年级、初中7-9年级
- 高中高频词汇和完整词库
- 多种题型：填空、选择、听写

### 🎵 互动体验
- 实时音效反馈
- 语音播放功能
- 动画效果
- 成绩统计

## 🚀 快速开始

### 在线体验
直接访问：[https://maxiusi3.github.io/wordchallenge/](https://maxiusi3.github.io/wordchallenge/)

### 双人对战测试
访问测试页面：[https://maxiusi3.github.io/wordchallenge/test-matching.html](https://maxiusi3.github.io/wordchallenge/test-matching.html)

## 🎮 游戏玩法

### 双人对战模式
1. 输入昵称和选择年级
2. 等待系统匹配对手
3. 三关对战，三局两胜制：
   - **关卡1**: 警察抓小偷 - 中译英填空
   - **关卡2**: 登天梯 - 英译中选择
   - **关卡3**: 赛车竞速 - 听写模式
4. 查看对战结果和统计

## 🔧 技术特性

### v2.1.0 新功能
- ✅ **真实跨设备匹配**: 支持iPad、MacBook等不同设备间对战
- ✅ **智能匹配算法**: 按年级自动匹配，确保公平竞争
- ✅ **AI对手备选**: 60秒无匹配自动提供AI助手
- ✅ **缓存管理**: 自动版本控制，解决更新问题
- ✅ **测试工具**: 完整的匹配测试界面

### 技术架构
- **前端**: HTML5 + CSS3 + JavaScript
- **样式**: Tailwind CSS
- **匹配系统**: Firebase + localStorage备选
- **音频**: Web Audio API + Edge TTS
- **部署**: GitHub Pages + Cloudflare CDN

## 📱 设备支持

### 完全支持
- 📱 iPad (Safari)
- 💻 MacBook (Chrome/Safari)
- 📱 iPhone (Safari)
- 🤖 Android (Chrome)
- 🖥️ Windows PC (Chrome/Edge)

### 最佳体验
- **iPad**: 专门优化的界面布局
- **触屏设备**: 触摸友好的交互设计
- **桌面设备**: 键盘快捷键支持

## 🔍 使用说明

### 双人对战匹配
1. **开始匹配**: 两个设备选择相同年级，点击"双人对战"
2. **等待匹配**: 系统自动寻找同年级玩家（最多60秒）
3. **开始游戏**: 匹配成功后自动进入对战界面
4. **AI备选**: 超时无匹配时自动提供AI对手

### 故障排除
- **匹配失败**: 确保两设备选择相同年级，清空浏览器缓存重试
- **缓存问题**: 硬刷新页面 (Ctrl+F5) 或使用隐私模式
- **跨设备问题**: 确保使用相同域名访问

## 🛠️ 开发和部署

### 本地开发
```bash
# 克隆仓库
git clone https://github.com/maxiusi3/wordchallenge.git

# 启动本地服务器
cd wordchallenge
python -m http.server 8000

# 访问游戏
open http://localhost:8000
```

### 测试匹配功能
```bash
# 访问测试页面
open http://localhost:8000/test-matching.html

# 或在线测试
open https://maxiusi3.github.io/wordchallenge/test-matching.html
```

### 调试命令
```javascript
// 查看匹配池状态
JSON.parse(localStorage.getItem('wordchallenge_matching_pool'))

// 清空匹配池
localStorage.removeItem('wordchallenge_matching_pool')

// 强制刷新缓存
window.forceRefresh()

// 查看版本信息
console.log(window.GAME_VERSION)
```

## 📊 项目统计

- **代码行数**: ~2000+ 行（简化后）
- **支持年级**: 7个年级 (小学3-6年级 + 初中7-9年级)
- **词汇量**: 5000+ 单词
- **游戏关卡**: 3个难度等级
- **设备支持**: 5+ 主流平台

## 🤝 贡献指南

欢迎提交Issue和Pull Request！

### 开发规范
- 使用ES6+语法
- 遵循响应式设计原则
- 添加适当的注释
- 测试跨设备兼容性

### 提交格式
```
🎮 feat: 添加新功能
🔧 fix: 修复问题
📚 docs: 更新文档
🎨 style: 样式调整
```

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 📞 联系方式

- **GitHub**: [maxiusi3](https://github.com/maxiusi3)
- **项目地址**: [wordchallenge](https://github.com/maxiusi3/wordchallenge)
- **在线演示**: [https://maxiusi3.github.io/wordchallenge/](https://maxiusi3.github.io/wordchallenge/)

---

## 🎯 更新日志

### v2.1.0 (2024-12-19)
- ✨ 专注双人对战模式
- 🗑️ 移除单人模式和管理员配置
- 🔧 简化代码结构
- 📱 优化移动端体验
- 🤖 保留AI对手备选机制

### v2.0.3 (2024-12-18)
- 🎲 实现随机题目系统
- 🔄 优化题库加载逻辑
- 📊 改进成绩统计

### v2.0.0 (2024-12-17)
- 🌐 转为纯在线游戏
- 🎮 添加双人对战模式
- 📱 iPad界面优化
- 🎵 集成Edge TTS语音

---

**享受学习，快乐成长！** 🌟
