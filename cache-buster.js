/**
 * 缓存破坏工具
 * 用于强制更新Cloudflare等CDN的缓存
 */

// 当前版本和构建时间
const CACHE_VERSION = '2.1.0-realmatch';
const BUILD_TIMESTAMP = Date.now();

// 在页面加载时清理旧缓存
window.addEventListener('load', function() {
    // 清理localStorage中的旧数据
    try {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('wordchallenge_') && key !== 'wordchallenge_matching_pool') {
                // 保留匹配池，清理其他旧数据
                const data = JSON.parse(localStorage.getItem(key) || '{}');
                if (data.version && data.version !== CACHE_VERSION) {
                    localStorage.removeItem(key);
                    console.log('清理旧缓存:', key);
                }
            }
        });
    } catch (error) {
        console.warn('清理缓存时出错:', error);
    }

    // 显示版本信息
    console.log(`%c🎮 单词闯关游戏 v${CACHE_VERSION}`, 'color: #4CAF50; font-size: 16px; font-weight: bold;');
    console.log(`%c🔄 真实跨设备对战系统已启用`, 'color: #FF9800; font-weight: bold;');
    console.log(`%c⏰ 构建时间: ${new Date(BUILD_TIMESTAMP).toLocaleString()}`, 'color: #2196F3;');
});

// 强制刷新函数
window.forceRefresh = function() {
    // 清理所有缓存
    if ('caches' in window) {
        caches.keys().then(names => {
            names.forEach(name => {
                caches.delete(name);
            });
        });
    }
    
    // 清理localStorage
    localStorage.clear();
    
    // 强制刷新页面
    window.location.reload(true);
};

// 导出版本信息
window.GAME_VERSION = CACHE_VERSION;
window.BUILD_TIME = BUILD_TIMESTAMP;
