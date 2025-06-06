// Firebase配置和初始化
// 注意：这些是公开的配置，不包含敏感信息

// Firebase配置对象 - 您需要替换为您自己的配置
const firebaseConfig = {
  apiKey: "AIzaSyBjQRnH4WTusCOJ0aVzylxct6Rf9Jo65EI",
  authDomain: "wordchallenge-0602.firebaseapp.com",
  databaseURL: "https://wordchallenge-0602-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "wordchallenge-0602",
  storageBucket: "wordchallenge-0602.firebasestorage.app",
  messagingSenderId: "595152654765",
  appId: "1:595152654765:web:6dc83063ab6d81c2615124",
  measurementId: "G-S02FE6LLW2"
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

            // 尝试匿名登录
            try {
                console.log('🔒 尝试Firebase匿名登录...');
                await firebase.auth().signInAnonymously();
                console.log('✅ Firebase匿名登录成功');
            } catch (authError) {
                console.error('❌ Firebase匿名登录失败:', authError.message, '错误码:', authError.code, '错误名:', authError.name, '堆栈:', authError.stack);
                // 如果匿名登录失败，也认为Firebase不可用
                console.log('🔄 回退到本地匹配模式 (匿名登录失败)');
                return false;
            }

            // 获取数据库引用
            this.database = firebase.database();

            // 测试数据库连接
            try {
                await this.testDatabaseConnection();
            } catch (dbError) {
                console.error('❌ Firebase数据库连接测试失败 (在init中捕获):', dbError.message, '错误码:', dbError.code || 'N/A', '错误名:', dbError.name || 'N/A', '堆栈:', dbError.stack || 'N/A');
                console.log('🔄 回退到本地匹配模式 (数据库连接测试失败)');
                return false;
            }

            // 监听连接状态
            this.setupConnectionMonitoring();

            this.isInitialized = true;
            console.log('✅ Firebase初始化成功');

            return true;
        } catch (error) {
            console.error('❌ Firebase初始化过程中发生意外错误:', error.message, '错误码:', error.code || 'N/A', '错误名:', error.name || 'N/A', '堆栈:', error.stack || 'N/A');

            // 如果Firebase初始化失败，回退到本地模拟
            console.log('🔄 回退到本地匹配模式 (初始化意外错误)');
            return false;
        }
    }

    /**
     * 测试数据库连接
     */
    async testDatabaseConnection() {
        try {
            console.log('🔍 正在测试Firebase数据库连接...');

            // 尝试写入一个测试值
            const testRef = this.database.ref('test/connection');
            await testRef.set({
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                message: 'connection_test'
            });

            console.log('✅ Firebase数据库连接成功');

            // 清理测试数据
            await testRef.remove();

        } catch (error) {
            console.error('❌ Firebase数据库连接失败:', error.message, '错误码:', error.code, '错误名:', error.name, '堆栈:', error.stack);

            if (error.code === 'PERMISSION_DENIED') {
                console.error('🚫 数据库权限被拒绝，请检查Firebase安全规则');
                console.log('📝 建议的安全规则：');
                console.log(`{
  "rules": {
    ".read": true,
    ".write": true
  }
}`);
            } else if (error.code === 'NETWORK_ERROR') {
                console.error('🌐 网络连接错误，请检查网络连接');
            } else {
                console.error('❓ 未知错误:', error.message);
            }

            throw error;
        }
    }

    /**
     * 加载Firebase SDK
     */
    loadFirebaseSDK() {
        return new Promise((resolve, reject) => {
            // 检查是否已经加载
            if (typeof firebase !== 'undefined') {
                console.log('✅ Firebase SDK已经加载');
                resolve();
                return;
            }

            console.log('📦 正在加载Firebase SDK...');

            // 尝试多个CDN源
            const cdnSources = [
                {
                    name: 'Google CDN',
                    core: 'https://www.gstatic.com/firebasejs/9.23.0/firebase-app-compat.js',
                    database: 'https://www.gstatic.com/firebasejs/9.23.0/firebase-database-compat.js',
                    auth: 'https://www.gstatic.com/firebasejs/9.23.0/firebase-auth-compat.js' // 添加Auth SDK
                },
                {
                    name: 'jsDelivr CDN',
                    core: 'https://cdn.jsdelivr.net/npm/firebase@9.23.0/compat/firebase-app.js',
                    database: 'https://cdn.jsdelivr.net/npm/firebase@9.23.0/compat/firebase-database.js',
                    auth: 'https://cdn.jsdelivr.net/npm/firebase@9.23.0/compat/firebase-auth.js' // 添加Auth SDK
                }
            ];

            let currentCdnIndex = 0;

            const tryLoadFromCdn = () => {
                if (currentCdnIndex >= cdnSources.length) {
                    reject(new Error('所有CDN源都加载失败，请检查网络连接或CDN可用性。'));
                    return;
                }

                const cdn = cdnSources[currentCdnIndex];
                console.log(`🔄 尝试从 ${cdn.name} 加载...`);

                // 加载Firebase核心库
                const coreScript = document.createElement('script');
                coreScript.src = cdn.core;
                coreScript.onload = () => {
                    // 加载数据库库
                    const dbScript = document.createElement('script');
                    dbScript.src = cdn.database;
                    dbScript.onload = () => {
                        // 加载认证库
                        const authScript = document.createElement('script');
                        authScript.src = cdn.auth; // 使用上面定义的auth cdn
                        authScript.onload = () => {
                            console.log(`✅ Firebase SDK (App, Database, Auth) 从 ${cdn.name} 加载完成`);
                            resolve();
                        };
                        authScript.onerror = () => {
                            console.warn(`⚠️ ${cdn.name} 认证库加载失败`);
                            currentCdnIndex++;
                            tryLoadFromCdn();
                        };
                        document.head.appendChild(authScript);
                    };
                    dbScript.onerror = () => {
                        console.warn(`⚠️ ${cdn.name} 数据库库加载失败`);
                        currentCdnIndex++;
                        tryLoadFromCdn();
                    };
                    document.head.appendChild(dbScript);
                };
                coreScript.onerror = () => {
                    console.warn(`⚠️ ${cdn.name} 核心库加载失败`);
                    currentCdnIndex++;
                    tryLoadFromCdn();
                };
                document.head.appendChild(coreScript);
            };

            tryLoadFromCdn();
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

    /**
     * Firebase诊断工具
     */
    async diagnose() {
        console.log('%c🔍 Firebase诊断工具', 'color: #e74c3c; font-size: 16px; font-weight: bold;');

        // 1. 检查配置
        console.log('📝 配置信息:');
        console.log('- 项目ID:', firebaseConfig.projectId);
        console.log('- 数据库URL:', firebaseConfig.databaseURL);
        console.log('- 域名:', firebaseConfig.authDomain);

        // 2. 检查SDK加载
        console.log('📦 SDK状态:');
        console.log('- Firebase SDK:', typeof firebase !== 'undefined' ? '✅ 已加载' : '❌ 未加载');

        if (typeof firebase !== 'undefined') {
            console.log('- Firebase版本:', firebase.SDK_VERSION || '未知');
        }

        // 3. 检查初始化状态
        console.log('🔥 初始化状态:');
        console.log('- 已初始化:', this.isInitialized ? '✅ 是' : '❌ 否');
        console.log('- 已连接:', this.isConnected ? '✅ 是' : '❌ 否');

        // 4. 测试数据库访问
        if (this.database) {
            try {
                console.log('🔍 正在测试数据库访问...');

                const testRef = this.database.ref('diagnostic/test');
                await testRef.set({
                    timestamp: Date.now(),
                    test: 'diagnostic'
                });

                const snapshot = await testRef.once('value');
                const data = snapshot.val();

                if (data) {
                    console.log('✅ 数据库读写测试成功');
                    await testRef.remove();
                } else {
                    console.log('❌ 数据库读取失败');
                }

            } catch (error) {
                console.error('❌ 数据库访问错误:', error);

                if (error.code === 'PERMISSION_DENIED') {
                    console.log('🚫 权限被拒绝 - 需要配置安全规则');
                    console.log('📝 请在Firebase控制台中设置以下安全规则:');
                    console.log(`{
  "rules": {
    ".read": true,
    ".write": true
  }
}`);
                }
            }
        }

        console.log('🔍 诊断完成');
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

// 暴露Firebase诊断工具到全局作用域
window.diagnoseFirebase = () => window.firebaseManager.diagnose();
window.initFirebase = () => window.firebaseManager.init();

// 页面加载完成后自动初始化Firebase
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('🚀 页面加载完成，自动初始化Firebase...');
        window.firebaseManager.init();
    });
} else {
    // 如果页面已经加载完成，立即初始化
    console.log('🚀 立即初始化Firebase...');
    window.firebaseManager.init();
}

// 提示用户可用的调试命令
console.log('%c🔧 Firebase调试工具已加载', 'color: #9b59b6; font-size: 14px; font-weight: bold;');
console.log('可用命令:');
console.log('- diagnoseFirebase() - 诊断Firebase连接问题');
console.log('- initFirebase() - 手动初始化Firebase');

console.log('🔥 Firebase配置已加载');
