# Firebase在线对战系统设置指南

## 概述

本指南将帮助您设置Firebase实时数据库，实现真正的跨设备在线匹配功能。

## 第一步：创建Firebase项目

1. **访问Firebase控制台**
   - 打开 [https://console.firebase.google.com/](https://console.firebase.google.com/)
   - 使用您的Google账号登录

2. **创建新项目**
   - 点击"创建项目"
   - 输入项目名称：`wordchallenge-online`（或您喜欢的名称）
   - 选择是否启用Google Analytics（可选）
   - 点击"创建项目"

## 第二步：设置实时数据库

1. **启用实时数据库**
   - 在Firebase控制台左侧菜单中，点击"Realtime Database"
   - 点击"创建数据库"
   - 选择数据库位置（建议选择离您用户最近的区域）
   - 选择安全规则模式：**"以测试模式启动"**（稍后我们会配置安全规则）

2. **配置安全规则**
   - 在"规则"标签页中，将规则替换为以下内容：

```json
{
  "rules": {
    "matching": {
      "$grade": {
        "$userId": {
          ".write": "$userId == auth.uid || auth == null",
          ".read": true,
          ".validate": "newData.hasChildren(['id', 'nickname', 'grade', 'timestamp', 'status'])"
        }
      }
    },
    "rooms": {
      "$roomId": {
        ".read": true,
        ".write": true,
        ".validate": "newData.hasChildren(['id', 'status', 'players', 'createdAt', 'grade'])"
      }
    },
    ".read": false,
    ".write": false
  }
}
```

## 第三步：获取配置信息

1. **获取项目配置**
   - 在Firebase控制台中，点击左上角的齿轮图标 → "项目设置"
   - 滚动到"您的应用"部分
   - 点击"</>"图标添加Web应用
   - 输入应用昵称：`wordchallenge-web`
   - 不需要设置Firebase Hosting
   - 点击"注册应用"

2. **复制配置代码**
   - 在"添加Firebase SDK"步骤中，复制配置对象
   - 配置对象类似这样：

```javascript
const firebaseConfig = {
  apiKey: "AIzaSyXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789012",
  appId: "1:123456789012:web:abcdef1234567890"
};
```

## 第四步：更新项目配置

1. **修改Firebase配置文件**
   - 打开 `js/firebase-config.js` 文件
   - 将第6-14行的演示配置替换为您的实际配置：

```javascript
// 将这个演示配置
const firebaseConfig = {
    apiKey: "demo-api-key",
    authDomain: "wordchallenge-demo.firebaseapp.com",
    databaseURL: "https://wordchallenge-demo-default-rtdb.firebaseio.com",
    projectId: "wordchallenge-demo",
    storageBucket: "wordchallenge-demo.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};

// 替换为您的实际配置
const firebaseConfig = {
    apiKey: "您的API密钥",
    authDomain: "您的项目.firebaseapp.com",
    databaseURL: "https://您的项目-default-rtdb.firebaseio.com",
    projectId: "您的项目ID",
    storageBucket: "您的项目.appspot.com",
    messagingSenderId: "您的发送者ID",
    appId: "您的应用ID"
};
```

## 第五步：测试配置

1. **部署到GitHub Pages**
   - 提交并推送您的更改到GitHub
   - 确保GitHub Pages已启用

2. **测试在线匹配**
   - 在两个不同的设备或浏览器中打开您的游戏
   - 选择相同的年级并开始匹配
   - 应该能够成功匹配到真实对手

## 第六步：监控和调试

1. **查看实时数据**
   - 在Firebase控制台的"Realtime Database"中，您可以实时查看匹配池和房间数据
   - 数据结构如下：
     ```
     /
     ├── matching/
     │   ├── g3/
     │   │   ├── user_123/
     │   │   └── user_456/
     │   └── g4/
     └── rooms/
         ├── room_789/
         └── room_101/
     ```

2. **调试工具**
   - 在浏览器控制台中使用以下命令：
   - `debugMatchingPool()` - 查看本地匹配池状态
   - `clearMatchingPool()` - 清空本地匹配池

## 安全注意事项

1. **数据库规则**
   - 当前规则允许匿名访问，适合测试
   - 生产环境建议启用Firebase Authentication

2. **API密钥安全**
   - Firebase Web API密钥是公开的，这是正常的
   - 安全性通过数据库规则控制，而不是API密钥

## 故障排除

### 问题1：Firebase初始化失败
- **解决方案**：检查配置信息是否正确，确保网络连接正常

### 问题2：无法匹配到真实对手
- **解决方案**：
  1. 检查Firebase控制台中的匹配池数据
  2. 确保两个用户选择了相同的年级
  3. 检查浏览器控制台是否有错误信息

### 问题3：匹配后无法进行游戏
- **解决方案**：
  1. 检查房间数据是否正确创建
  2. 确保游戏动作能够正常发送和接收

## 免费额度说明

Firebase实时数据库免费套餐包括：
- **数据传输**：每月1GB
- **连接数**：100个并发连接
- **操作数**：无限制

对于您的单词游戏，这个免费额度完全足够使用。

## 下一步

设置完成后，您的游戏将支持：
- ✅ 真正的跨设备在线匹配
- ✅ 实时游戏状态同步
- ✅ 断线重连机制
- ✅ 自动回退到AI对手

如果遇到任何问题，请检查浏览器控制台的错误信息，或参考Firebase官方文档。
