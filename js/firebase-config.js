// Firebase配置和初始化
// 注意：这些是公开的配置，不包含敏感信息

// Firebase配置对象 - 您需要替换为您自己的配置
const firebaseConfig = {
    // 临时使用演示配置，您需要替换为自己的Firebase项目配置
    apiKey: "demo-api-key",
    authDomain: "wordchallenge-demo.firebaseapp.com",
    databaseURL: "https://wordchallenge-demo-default-rtdb.firebaseio.com",
    projectId: "wordchallenge-demo",
    storageBucket: "wordchallenge-demo.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef123456"
};

// Firebase服务管理器
class FirebaseManager {
    constructor() {
        this.app = null;
        this.database = null;
        this.isInitialized = false;
        this.connectionRef = null;
        this.isConnected = false;
        
        // 绑定方法
        this.init = this.init.bind(this);
        this.onConnectionChange = this.onConnectionChange.bind(this);
    }

    /**
     * 初始化Firebase
     */
    async init() {
        if (this.isInitialized) {
            return true;
        }

        try {
            console.log('🔥 正在初始化Firebase...');
            
            // 检查Firebase SDK是否已加载
            if (typeof firebase === 'undefined') {
                await this.loadFirebaseSDK();
            }

            // 初始化Firebase应用
            if (!firebase.apps.length) {
                this.app = firebase.initializeApp(firebaseConfig);
            } else {
                this.app = firebase.app();
            }

            // 获取数据库引用
            this.database = firebase.database();
            
            // 监听连接状态
            this.setupConnectionMonitoring();
            
            this.isInitialized = true;
            console.log('✅ Firebase初始化成功');
            
            return true;
        } catch (error) {
            console.error('❌ Firebase初始化失败:', error);
            
            // 如果Firebase初始化失败，回退到本地模拟
            console.log('🔄 回退到本地匹配模式');
            return false;
        }
    }

    /**
     * 加载Firebase SDK
     */
    loadFirebaseSDK() {
        return new Promise((resolve, reject) => {
            // 检查是否已经加载
            if (typeof firebase !== 'undefined') {
                resolve();
                return;
            }

            console.log('📦 正在加载Firebase SDK...');

            // 加载Firebase核心库
            const coreScript = document.createElement('script');
            coreScript.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js';
            coreScript.onload = () => {
                // 加载数据库库
                const dbScript = document.createElement('script');
                dbScript.src = 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js';
                dbScript.onload = () => {
                    console.log('✅ Firebase SDK加载完成');
                    resolve();
                };
                dbScript.onerror = reject;
                document.head.appendChild(dbScript);
            };
            coreScript.onerror = reject;
            document.head.appendChild(coreScript);
        });
    }

    /**
     * 设置连接状态监控
     */
    setupConnectionMonitoring() {
        this.connectionRef = this.database.ref('.info/connected');
        this.connectionRef.on('value', this.onConnectionChange);
    }

    /**
     * 处理连接状态变化
     */
    onConnectionChange(snapshot) {
        const connected = snapshot.val();
        this.isConnected = connected;
        
        if (connected) {
            console.log('🌐 Firebase连接已建立');
        } else {
            console.log('📡 Firebase连接已断开');
        }

        // 通知其他组件连接状态变化
        window.dispatchEvent(new CustomEvent('firebaseConnectionChange', {
            detail: { connected: this.isConnected }
        }));
    }

    /**
     * 获取数据库引用
     */
    getDatabase() {
        return this.database;
    }

    /**
     * 检查是否已连接
     */
    isConnectedToFirebase() {
        return this.isInitialized && this.isConnected;
    }

    /**
     * 清理资源
     */
    cleanup() {
        if (this.connectionRef) {
            this.connectionRef.off('value', this.onConnectionChange);
            this.connectionRef = null;
        }
    }
}

// 创建全局Firebase管理器实例
window.firebaseManager = new FirebaseManager();

// 页面卸载时清理资源
window.addEventListener('beforeunload', () => {
    if (window.firebaseManager) {
        window.firebaseManager.cleanup();
    }
});

console.log('🔥 Firebase配置已加载');
