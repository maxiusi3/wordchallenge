// Navigation utilities for 单词闯关游戏
// 这个文件包含导航相关的辅助函数

// 检查网络连接状态
function checkNetworkStatus() {
    return navigator.onLine;
}

// 显示网络状态
function showNetworkStatus() {
    const isOnline = checkNetworkStatus();
    console.log(`[Navigation] Network status: ${isOnline ? 'Online' : 'Offline'}`);
    return isOnline;
}

// 监听网络状态变化
function setupNetworkListeners() {
    window.addEventListener('online', () => {
        console.log('[Navigation] Network: Back online');
        // 可以在这里添加重新连接的逻辑
    });

    window.addEventListener('offline', () => {
        console.log('[Navigation] Network: Gone offline');
        // 可以在这里添加离线提示
    });
}

// 初始化网络监听
if (typeof window !== 'undefined') {
    setupNetworkListeners();
}

// 导出函数（如果在模块环境中）
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        checkNetworkStatus,
        showNetworkStatus,
        setupNetworkListeners
    };
}

console.log('[Navigation] Navigation utilities loaded');
