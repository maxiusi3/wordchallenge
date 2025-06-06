// 网络状态管理器 - 纯在线游戏版本
class NetworkManager {
    constructor() {
        this.isOnline = navigator.onLine;
        this.loadingIndicator = null;
        
        // 监听网络状态变化
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('[NetworkManager] 网络已连接');
            this.hideOfflineMessage();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('[NetworkManager] 网络已断开');
            this.showOfflineMessage();
        });
    }

    // 显示加载指示器
    showLoading(message = '正在加载...') {
        this.hideLoading(); // 先隐藏之前的
        
        this.loadingIndicator = document.createElement('div');
        this.loadingIndicator.id = 'network-loading';
        this.loadingIndicator.innerHTML = `
            <div style="
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.7);
                display: flex;
                justify-content: center;
                align-items: center;
                z-index: 10000;
                font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
            ">
                <div style="
                    background: white;
                    padding: 30px;
                    border-radius: 15px;
                    text-align: center;
                    box-shadow: 0 10px 30px rgba(0,0,0,0.3);
                    max-width: 300px;
                ">
                    <div style="
                        width: 40px;
                        height: 40px;
                        border: 4px solid #f3f3f3;
                        border-top: 4px solid #4CAF50;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 20px;
                    "></div>
                    <div style="color: #333; font-size: 16px;">${message}</div>
                </div>
            </div>
            <style>
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
            </style>
        `;
        
        document.body.appendChild(this.loadingIndicator);
    }

    // 隐藏加载指示器
    hideLoading() {
        if (this.loadingIndicator) {
            this.loadingIndicator.remove();
            this.loadingIndicator = null;
        }
    }

    // 显示离线消息
    showOfflineMessage() {
        const offlineMessage = document.createElement('div');
        offlineMessage.id = 'offline-message';
        offlineMessage.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #ff4444;
                color: white;
                padding: 15px 25px;
                border-radius: 25px;
                z-index: 9999;
                font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
                box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                animation: slideDown 0.3s ease-out;
            ">
                🔌 网络连接已断开，游戏需要网络连接才能正常运行
            </div>
            <style>
                @keyframes slideDown {
                    from { transform: translateX(-50%) translateY(-100%); }
                    to { transform: translateX(-50%) translateY(0); }
                }
            </style>
        `;
        
        // 移除之前的离线消息
        const existing = document.getElementById('offline-message');
        if (existing) existing.remove();
        
        document.body.appendChild(offlineMessage);
    }

    // 隐藏离线消息
    hideOfflineMessage() {
        const offlineMessage = document.getElementById('offline-message');
        if (offlineMessage) {
            offlineMessage.style.animation = 'slideUp 0.3s ease-out forwards';
            setTimeout(() => offlineMessage.remove(), 300);
        }
    }

    // 检查网络状态
    checkConnection() {
        return this.isOnline;
    }

    // 带重试的网络请求
    async fetchWithRetry(url, options = {}, maxRetries = 3) {
        if (!this.isOnline) {
            throw new Error('网络连接不可用');
        }

        let lastError;
        
        for (let i = 0; i < maxRetries; i++) {
            try {
                console.log(`[NetworkManager] 尝试请求 ${url} (第 ${i + 1} 次)`);
                
                const response = await fetch(url, {
                    ...options,
                    // 添加超时控制
                    signal: AbortSignal.timeout(10000) // 10秒超时
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                console.log(`[NetworkManager] 请求成功: ${url}`);
                return response;
                
            } catch (error) {
                lastError = error;
                console.warn(`[NetworkManager] 请求失败 (第 ${i + 1} 次):`, error.message);
                
                // 如果不是最后一次重试，等待一段时间再重试
                if (i < maxRetries - 1) {
                    const delay = Math.pow(2, i) * 1000; // 指数退避：1s, 2s, 4s
                    console.log(`[NetworkManager] ${delay}ms 后重试...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                }
            }
        }
        
        throw new Error(`网络请求失败，已重试 ${maxRetries} 次。最后错误: ${lastError.message}`);
    }

    // 显示错误消息
    showError(message, duration = 5000) {
        const errorMessage = document.createElement('div');
        errorMessage.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #ff4444;
                color: white;
                padding: 15px 25px;
                border-radius: 25px;
                z-index: 9999;
                font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
                box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                animation: slideDown 0.3s ease-out;
                max-width: 80%;
                text-align: center;
            ">
                ⚠️ ${message}
            </div>
        `;
        
        document.body.appendChild(errorMessage);
        
        // 自动移除
        setTimeout(() => {
            errorMessage.style.animation = 'slideUp 0.3s ease-out forwards';
            setTimeout(() => errorMessage.remove(), 300);
        }, duration);
    }

    // 显示成功消息
    showSuccess(message, duration = 3000) {
        const successMessage = document.createElement('div');
        successMessage.innerHTML = `
            <div style="
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: #4CAF50;
                color: white;
                padding: 15px 25px;
                border-radius: 25px;
                z-index: 9999;
                font-family: 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif;
                box-shadow: 0 5px 15px rgba(0,0,0,0.3);
                animation: slideDown 0.3s ease-out;
                max-width: 80%;
                text-align: center;
            ">
                ✅ ${message}
            </div>
        `;
        
        document.body.appendChild(successMessage);
        
        // 自动移除
        setTimeout(() => {
            successMessage.style.animation = 'slideUp 0.3s ease-out forwards';
            setTimeout(() => successMessage.remove(), 300);
        }, duration);
    }
}

// 创建全局实例
window.networkManager = new NetworkManager();

// 页面加载时检查网络状态
document.addEventListener('DOMContentLoaded', () => {
    if (!window.networkManager.checkConnection()) {
        window.networkManager.showOfflineMessage();
    }
});

console.log('[NetworkManager] 网络管理器已初始化');
