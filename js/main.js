// --- 简化版 main.js ---
// 只保留双人模式需要的题库加载功能
// 所有单人模式和管理员配置相关代码已被移除

// --- Constants ---
const QUESTION_TIME_LIMIT = 15; // Seconds per question
const LEVEL_COUNT = 3; // Fixed number of levels
const ATTEMPTS_PER_QUESTION_L1_L3 = 3; // Attempts for Level 1 & 3

// --- DOM References ---
const screenFrame = document.getElementById('screenFrame');

// --- Utility Functions ---

// Send message to the currently loaded iframe
function sendMessageToIframe(action, payload) {
    if (screenFrame && screenFrame.contentWindow) {
        console.log(`Sending message to iframe:`, { action, payload });
        screenFrame.contentWindow.postMessage({ action, payload }, '*');
    } else {
        console.warn("Cannot send message to iframe: screenFrame or contentWindow not available.");
    }
}

// --- 题库加载功能 (双人模式需要) ---

/**
 * 加载指定年级的题库数据
 * 这个函数被双人模式的 BattleManager 使用
 */
async function loadQuestionsForGrade(gradeId) {
    console.log(`Loading questions for grade: ${gradeId}`);
    
    // 确保网络管理器可用
    if (typeof window.networkManager === 'undefined') {
        console.warn('Network manager not available, using basic fetch');
    }

    let primaryPath;
    
    // 根据年级ID映射到正确的题库文件路径
    switch (gradeId) {
        case 'g3':
        case 'grade3':
            primaryPath = 'data/renjiaoban/grade3.json';
            break;
        case 'g4':
        case 'grade4':
            primaryPath = 'data/renjiaoban/grade4.json';
            break;
        case 'g5':
        case 'grade5':
            primaryPath = 'data/renjiaoban/grade5.json';
            break;
        case 'g6':
        case 'grade6':
            primaryPath = 'data/renjiaoban/grade6.json';
            break;
        case 'g7':
        case 'grade7':
            primaryPath = 'data/renjiaoban/grade7.json';
            break;
        case 'g8':
        case 'grade8':
            primaryPath = 'data/renjiaoban/grade8.json';
            break;
        case 'g9':
        case 'grade9':
            primaryPath = 'data/renjiaoban/grade9.json';
            break;
        case 'grade10':
        case 'hshf':
            primaryPath = 'data/renjiaoban/highschool_high_freq.json';
            break;
        case 'grade11':
        case 'grade12':
        case 'hsa':
            primaryPath = 'data/renjiaoban/highschool_all.json';
            break;
        default:
            if (gradeId && gradeId.startsWith('g') && /^g\d+$/.test(gradeId)) {
                primaryPath = `data/renjiaoban/grade${gradeId.substring(1)}.json`;
            } else {
                primaryPath = `data/renjiaoban/${gradeId}.json`;
            }
            break;
    }

    console.log(`Loading questions from: ${primaryPath}`);

    try {
        let response;
        
        // 使用网络管理器（如果可用）或基本fetch
        if (window.networkManager && typeof window.networkManager.fetchWithRetry === 'function') {
            response = await window.networkManager.fetchWithRetry(primaryPath);
        } else {
            response = await fetch(primaryPath);
        }

        if (!response.ok) {
            throw new Error(`Failed to load questions: ${response.status} ${response.statusText}`);
        }

        const questions = await response.json();
        
        if (!Array.isArray(questions) || questions.length === 0) {
            throw new Error(`Invalid or empty question data for grade ${gradeId}`);
        }

        console.log(`Successfully loaded ${questions.length} questions for grade ${gradeId}`);
        return questions;

    } catch (error) {
        console.error(`Error loading questions for grade ${gradeId}:`, error);
        throw error;
    }
}

// --- 消息处理 (简化版) ---

// 监听来自iframe的消息
window.addEventListener('message', (event) => {
    const screenFrame = document.getElementById('screenFrame');
    if (screenFrame && event.source === screenFrame.contentWindow &&
        typeof event.data === 'object' && event.data !== null) {

        const messageData = event.data;
        console.log("Received message from iframe:", messageData);

        switch (messageData.action) {
            case 'navigate':
                console.log(`Navigation requested to: ${messageData.screen}`);
                if (messageData.screen && typeof navigateTo === 'function') {
                    navigateTo(messageData.screen);
                } else {
                    console.warn("Navigation failed: screen not specified or navigateTo not available");
                }
                break;

            case 'setBattleUserInfo':
                // 存储双人对战用户信息
                window.battleUserInfo = {
                    nickname: messageData.nickname,
                    grade: messageData.grade,
                    gradeName: messageData.gradeName,
                    avatar: messageData.avatar || '😎'
                };
                console.log('Battle user info set:', window.battleUserInfo);
                break;

            case 'startBattleGame':
                // 启动双人对战游戏
                console.log('Starting battle game...');
                if (window.battleManager && window.battleUserInfo && window.opponentInfo) {
                    window.battleManager.initializeBattle(window.battleUserInfo, window.opponentInfo);
                } else {
                    console.error('Cannot start battle: missing battleManager, user info, or opponent info');
                }
                break;

            default:
                console.log(`Unhandled message action: ${messageData.action}`);
                break;
        }
    }
});

// --- 初始化 ---
// 导出题库加载函数供双人模式使用
window.loadQuestionsForGrade = loadQuestionsForGrade;
