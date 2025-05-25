/**
 * 配置文件
 * 包含应用程序的全局配置
 */

const CONFIG = {
    // 基本游戏设置
    ADMIN_PASSWORD: 'admin321',
    QUESTION_TIME_LIMIT: 15, // 每题时间限制（秒）
    LEVEL_COUNT: 3, // 关卡数量
    ATTEMPTS_PER_QUESTION_L1_L3: 3, // 第一关和第三关的尝试次数

    // 路径配置
    PATHS: {
        WORD_BANK: '/data/人教版/', // 题库路径
        AUDIO: '/audio/', // 音效路径
        SCREENS: 'screens/' // 屏幕路径
    },

    // 默认关卡配置
    DEFAULT_LEVEL_CONFIG: {
        level1: { totalQuestions: 10, targetScore: 5 },
        level2: { totalQuestions: 10, targetScore: 5 },
        level3: { totalQuestions: 10, targetScore: 5 }
    },

    // 年级映射
    GRADE_MAPPING: {
        'g3': { path: 'grade3.json', name: '小学三年级' },
        'grade3': { path: 'grade3.json', name: '小学三年级' },
        'g4': { path: 'grade4.json', name: '小学四年级' },
        'grade4': { path: 'grade4.json', name: '小学四年级' },
        'g5': { path: 'grade5.json', name: '小学五年级' },
        'grade5': { path: 'grade5.json', name: '小学五年级' },
        'g6': { path: 'grade6.json', name: '小学六年级' },
        'grade6': { path: 'grade6.json', name: '小学六年级' },
        'g7': { path: 'grade7.json', name: '初中一年级' },
        'grade7': { path: 'grade7.json', name: '初中一年级' },
        'g8': { path: 'grade8.json', name: '初中二年级' },
        'grade8': { path: 'grade8.json', name: '初中二年级' },
        'g9': { path: 'grade9.json', name: '初中三年级' },
        'grade9': { path: 'grade9.json', name: '初中三年级' },
        'grade10': { path: 'highschool_high_freq.json', name: '高一' },
        'hshf': { path: 'highschool_high_freq.json', name: '高一' },
        'grade11': { path: 'highschool_all.json', name: '高二' },
        'grade12': { path: 'highschool_all.json', name: '高三' },
        'hsa': { path: 'highschool_all.json', name: '高中' }
    },

    // 音效配置
    SOUNDS: {
        UI: {
            CLICK: 'click.wav',
            CONFIRM: 'confirm.wav',
            CANCEL: 'cancel.wav',
            ERROR: 'error.wav',
            LOGIN: 'login.wav',
            SELECT: 'select.wav',
            SUCCESS: 'success.wav',
            TYPING: 'typing.wav'
        },
        GAME: {
            CORRECT: 'correct.wav',
            INCORRECT: 'incorrect.wav',
            INCORRECT_FINAL: 'incorrect_final.wav',
            LEVEL_WIN: 'level_win.wav',
            LEVEL_LOSE: 'level_lose.wav',
            CHALLENGE_WIN: 'challenge_win.wav',
            CHALLENGE_LOSE: 'challenge_lose.wav',
            TIMEOUT: 'timeout.wav',
            TIMER_END: 'timer_end.wav',
            TIMER_TICK_WARN: 'timer_tick_warn.wav'
        }
    }
};
