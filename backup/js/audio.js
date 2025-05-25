/**
 * 音频处理模块
 * 简化版，专注于可靠性
 */

// --- 全局变量 ---
let audioContext = null;
const soundBuffers = {};
const activeSoundSources = {};

// --- 音效配置 ---
const SOUNDS = {
    'click': 'audio/click.wav',
    'correct': 'audio/correct.wav',
    'incorrect': 'audio/incorrect.wav',
    'success': 'audio/success.wav',
    'error': 'audio/error.wav',
    'timer_warning': 'audio/timer_tick_warn.wav',
    'timer_zero': 'audio/timer_end.wav',
    'login': 'audio/login.wav',
    'confirm': 'audio/confirm.wav',
    'typing': 'audio/typing.wav'
};

/**
 * 初始化音频上下文
 * 必须在用户交互后调用
 */
async function initAudioContext() {
    if (audioContext) {
        // 如果已经存在，尝试恢复
        if (audioContext.state === 'suspended') {
            try {
                await audioContext.resume();
                console.log('[音频] 音频上下文已恢复');
            } catch (err) {
                console.warn('[音频] 恢复音频上下文失败:', err);
            }
        }
        return audioContext;
    }

    try {
        // 创建新的音频上下文
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        audioContext = new AudioContext();
        console.log('[音频] 音频上下文已初始化，状态:', audioContext.state);

        // 如果是suspended状态，尝试恢复
        if (audioContext.state === 'suspended') {
            try {
                await audioContext.resume();
                console.log('[音频] 音频上下文已恢复');
            } catch (err) {
                console.warn('[音频] 恢复音频上下文失败:', err);
            }
        }

        return audioContext;
    } catch (err) {
        console.error('[音频] 初始化音频上下文失败:', err);
        return null;
    }
}

/**
 * 加载单个音效
 * @param {string} name - 音效名称
 * @param {string} url - 音效文件URL
 */
async function loadSound(name, url) {
    if (!audioContext) {
        try {
            await initAudioContext();
        } catch (err) {
            console.warn(`[音频] 加载音效 "${name}" 失败: 音频上下文初始化失败`);
            return;
        }
    }

    // 如果已经加载，直接返回
    if (soundBuffers[name]) return;

    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`获取音效文件失败: ${response.status} ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
        soundBuffers[name] = audioBuffer;
        console.log(`[音频] 音效 "${name}" 加载成功`);
    } catch (err) {
        console.warn(`[音频] 加载音效 "${name}" 失败:`, err);
    }
}

/**
 * 预加载所有音效
 */
async function preloadSounds() {
    if (!audioContext) {
        try {
            await initAudioContext();
        } catch (err) {
            console.warn('[音频] 预加载音效前初始化音频上下文失败:', err);
            return;
        }
    }

    const loadPromises = [];

    for (const [name, url] of Object.entries(SOUNDS)) {
        loadPromises.push(loadSound(name, url));
    }

    try {
        await Promise.all(loadPromises);
        console.log('[音频] 所有音效预加载完成');
    } catch (err) {
        console.warn('[音频] 部分音效预加载失败:', err);
    }
}

/**
 * 播放音效
 * @param {string} name - 音效名称
 * @param {boolean} throttle - 是否节流（防止短时间内重复播放）
 */
function playSound(name, throttle = false) {
    if (!audioContext) {
        try {
            // 尝试初始化音频上下文（但不等待）
            initAudioContext();
        } catch (err) {
            console.warn('[音频] 播放音效失败: 音频上下文初始化失败');
            return;
        }
    }

    // 节流控制
    if (throttle && playSound.lastPlayed && playSound.lastPlayed[name]) {
        const now = Date.now();
        const timeSinceLastPlay = now - playSound.lastPlayed[name];
        if (timeSinceLastPlay < 300) { // 300ms内不重复播放
            return;
        }
    }

    // 记录播放时间（用于节流）
    if (throttle) {
        if (!playSound.lastPlayed) playSound.lastPlayed = {};
        playSound.lastPlayed[name] = Date.now();
    }

    // 如果音效已加载，直接播放
    if (soundBuffers[name]) {
        try {
            // 停止之前的音效
            if (activeSoundSources[name]) {
                try {
                    activeSoundSources[name].stop(0);
                } catch (e) {}
                delete activeSoundSources[name];
            }

            const source = audioContext.createBufferSource();
            source.buffer = soundBuffers[name];
            source.connect(audioContext.destination);
            source.start(0);
            activeSoundSources[name] = source;

            // 播放结束后清理
            source.onended = () => {
                if (activeSoundSources[name] === source) {
                    delete activeSoundSources[name];
                }
            };
        } catch (err) {
            console.warn(`[音频] 播放音效 "${name}" 失败:`, err);
        }
        return;
    }

    // 如果音效未加载，尝试加载并播放
    if (SOUNDS[name]) {
        loadSound(name, SOUNDS[name]).then(() => {
            if (soundBuffers[name]) {
                try {
                    const source = audioContext.createBufferSource();
                    source.buffer = soundBuffers[name];
                    source.connect(audioContext.destination);
                    source.start(0);

                    // 播放结束后清理
                    source.onended = () => {
                        if (activeSoundSources[name] === source) {
                            delete activeSoundSources[name];
                        }
                    };
                } catch (err) {
                    console.warn(`[音频] 播放音效 "${name}" 失败:`, err);
                }
            }
        }).catch(err => {
            console.warn(`[音频] 播放音效 "${name}" 失败:`, err);
        });
    } else {
        console.warn(`[音频] 未知音效: "${name}"`);
    }
}

/**
 * 使用多种方式播放单词
 * 增强版，使用多种备选方案
 * @param {string} word - 要播放的单词
 * @param {Function} onEnd - 播放结束回调
 * @param {Function} onError - 错误回调
 */
function playWordWithTTS(word, onEnd, onError) {
    console.log(`[音频] 开始播放单词: "${word}"`);

    // 确保回调函数最终会被调用
    let callbackCalled = false;

    // 安全回调函数
    const safeCallback = (isSuccess) => {
        if (callbackCalled) return;
        callbackCalled = true;

        if (isSuccess && typeof onEnd === 'function') {
            try {
                onEnd();
            } catch (e) {
                console.error('[音频] 回调函数错误:', e);
            }
        } else if (!isSuccess && typeof onError === 'function') {
            try {
                onError({error: 'tts_failed', message: 'TTS播放失败'});
            } catch (e) {
                console.error('[音频] 错误回调函数错误:', e);
                // 如果错误回调也失败，尝试调用成功回调以继续游戏
                if (typeof onEnd === 'function') {
                    try { onEnd(); } catch (e) { }
                }
            }
        } else if (!isSuccess && typeof onEnd === 'function') {
            // 如果没有错误回调，调用成功回调以继续游戏
            try { onEnd(); } catch (e) { }
        }
    };

    // 设置安全超时，确保回调最终会被调用
    const safetyTimeout = setTimeout(() => {
        console.warn(`[音频] TTS播放超时: "${word}"`);
        safeCallback(true); // 即使超时也当作成功处理，以继续游戏
    }, 5000);

    // 尝试使用不同的方法播放单词
    tryPlayWithWebSpeechAPI();

    // 方法1: 使用Web Speech API
    function tryPlayWithWebSpeechAPI() {
        // 检查浏览器是否支持Web Speech API
        if (!('speechSynthesis' in window)) {
            console.warn('[音频] 浏览器不支持Web Speech API');
            tryPlayWithAudioElement();
            return;
        }

        try {
            // 创建语音对象
            const utterance = new SpeechSynthesisUtterance(word);
            utterance.lang = 'en-US';
            utterance.rate = 0.9;
            utterance.pitch = 1.0;
            utterance.volume = 1.0;

            // 设置事件处理
            utterance.onend = () => {
                clearTimeout(safetyTimeout);
                console.log(`[音频] Web Speech API播放完成: "${word}"`);
                safeCallback(true);
            };

            utterance.onerror = (event) => {
                console.error(`[音频] Web Speech API播放错误: "${word}"`, event);
                tryPlayWithAudioElement();
            };

            // 播放
            window.speechSynthesis.cancel(); // 取消之前的语音
            window.speechSynthesis.speak(utterance);
            console.log(`[音频] Web Speech API开始播放: "${word}"`);

            // 设置定期检查，防止某些浏览器的限制
            const keepAliveInterval = setInterval(() => {
                if (!callbackCalled && window.speechSynthesis) {
                    try {
                        window.speechSynthesis.pause();
                        window.speechSynthesis.resume();
                    } catch (e) {}
                } else {
                    clearInterval(keepAliveInterval);
                }
            }, 1000);

            // 设置方法特定超时
            setTimeout(() => {
                if (!callbackCalled) {
                    console.warn(`[音频] Web Speech API超时，尝试下一种方法: "${word}"`);
                    clearInterval(keepAliveInterval);
                    try { window.speechSynthesis.cancel(); } catch (e) {}
                    tryPlayWithAudioElement();
                }
            }, 3000);
        } catch (error) {
            console.error(`[音频] Web Speech API初始化错误:`, error);
            tryPlayWithAudioElement();
        }
    }

    // 方法2: 使用Audio元素和在线服务
    function tryPlayWithAudioElement() {
        if (callbackCalled) return;

        console.log(`[音频] 尝试使用Audio元素播放: "${word}"`);

        // 尝试使用在线服务获取发音
        const encodedWord = encodeURIComponent(word);

        // 尝试多个在线服务
        const urls = [
            `https://api.dictionaryapi.dev/media/pronunciations/en/${encodedWord}-us.mp3`, // 字典API
            `https://ssl.gstatic.com/dictionary/static/sounds/oxford/${encodedWord}--_us_1.mp3`, // Google
            `https://dict.youdao.com/dictvoice?audio=${encodedWord}&type=2` // 有道字典
        ];

        let currentUrlIndex = 0;
        let audio = new Audio();

        // 设置事件处理
        audio.onended = () => {
            clearTimeout(safetyTimeout);
            console.log(`[音频] Audio元素播放完成: "${word}"`);
            safeCallback(true);
        };

        audio.onerror = () => {
            currentUrlIndex++;
            if (currentUrlIndex < urls.length) {
                console.log(`[音频] 尝试下一个音频源: ${urls[currentUrlIndex]}`);
                audio.src = urls[currentUrlIndex];
                audio.load();
                audio.play().catch(e => {
                    console.error(`[音频] 播放音频失败:`, e);
                    if (currentUrlIndex === urls.length - 1) {
                        tryPlayWithSpeechSynthesisAPI();
                    }
                });
            } else {
                console.warn(`[音频] 所有音频源均失败，尝试下一种方法`);
                tryPlayWithSpeechSynthesisAPI();
            }
        };

        // 开始播放第一个源
        audio.src = urls[currentUrlIndex];
        audio.load();
        audio.play().catch(e => {
            console.error(`[音频] 播放音频失败:`, e);
            audio.onerror(); // 手动触发错误处理
        });

        // 设置方法特定超时
        setTimeout(() => {
            if (!callbackCalled) {
                console.warn(`[音频] Audio元素超时，尝试下一种方法: "${word}"`);
                tryPlayWithSpeechSynthesisAPI();
            }
        }, 3000);
    }

    // 方法3: 使用SpeechSynthesis API的另一种方式
    function tryPlayWithSpeechSynthesisAPI() {
        if (callbackCalled) return;

        console.log(`[音频] 尝试使用SpeechSynthesis API的另一种方式: "${word}"`);

        // 尝试使用不同的语音和设置
        try {
            if (!('speechSynthesis' in window)) {
                playSimpleSound();
                return;
            }

            // 获取可用的语音
            const voices = window.speechSynthesis.getVoices();
            const utterance = new SpeechSynthesisUtterance(word);

            // 尝试找到一个英语语音
            const englishVoice = voices.find(voice =>
                voice.lang.includes('en') && voice.localService === true
            );

            if (englishVoice) {
                utterance.voice = englishVoice;
                console.log(`[音频] 使用语音: ${englishVoice.name}`);
            }

            utterance.lang = 'en-US';
            utterance.rate = 0.8; // 更慢一点
            utterance.pitch = 1.1; // 稍微不同的音调
            utterance.volume = 1.0;

            utterance.onend = () => {
                clearTimeout(safetyTimeout);
                console.log(`[音频] SpeechSynthesis API另一种方式播放完成: "${word}"`);
                safeCallback(true);
            };

            utterance.onerror = () => {
                console.error(`[音频] SpeechSynthesis API另一种方式播放错误: "${word}"`);
                playSimpleSound();
            };

            window.speechSynthesis.cancel();
            window.speechSynthesis.speak(utterance);

            // 设置方法特定超时
            setTimeout(() => {
                if (!callbackCalled) {
                    console.warn(`[音频] SpeechSynthesis API另一种方式超时，使用简单音频反馈: "${word}"`);
                    playSimpleSound();
                }
            }, 3000);
        } catch (error) {
            console.error(`[音频] SpeechSynthesis API另一种方式错误:`, error);
            playSimpleSound();
        }
    }

    // 简单音频反馈（作为最后的备用）
    function playSimpleSound() {
        if (callbackCalled) return;

        console.log(`[音频] 使用简单音频反馈: "${word}"`);
        try {
            if (typeof playSound === 'function') {
                playSound('click');
            }
            // 短暂延迟后调用回调
            setTimeout(() => safeCallback(true), 300);
        } catch (e) {
            console.error('[音频] 简单音频反馈失败:', e);
            safeCallback(true);
        }
    }
}

/**
 * 播放单词的统一入口
 * @param {string} word - 要播放的单词
 * @param {Function} onEnd - 播放结束回调
 * @param {Function} onError - 错误回调
 */
function playWord(word, onEnd, onError) {
    if (!word || typeof word !== 'string') {
        console.error('[音频] 无效的单词:', word);
        if (typeof onError === 'function') {
            try {
                onError({error: 'invalid_word', message: '无效的单词'});
            } catch (e) {
                console.error('[音频] 错误回调函数错误:', e);
                if (typeof onEnd === 'function') {
                    try { onEnd(); } catch (e) { }
                }
            }
        } else if (typeof onEnd === 'function') {
            try { onEnd(); } catch (e) { }
        }
        return;
    }

    console.log(`[音频] 播放单词: "${word}"`);

    // 确保音频上下文已初始化
    if (window.initAudioContext) {
        window.initAudioContext().catch(err => {
            console.warn('[音频] 初始化音频上下文失败:', err);
        });
    }

    // 直接使用TTS播放
    playWordWithTTS(word, onEnd, onError);
}

// 导出全局函数
window.initAudioContext = initAudioContext;
window.preloadSounds = preloadSounds;
window.playSound = playSound;
window.playWordWithTTS = playWord; // 使用统一入口
