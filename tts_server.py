#!/usr/bin/env python3
"""
Edge TTS 服务器
使用微软 Edge 的文本转语音 API
"""

import asyncio
import edge_tts
from flask import Flask, request, jsonify, send_file
from flask_cors import CORS
import tempfile
import os
import logging
from concurrent.futures import ThreadPoolExecutor

# 配置日志
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # 允许跨域请求

# 配置语音参数
VOICE_CONFIG = {
    'voice': 'en-US-AriaNeural',  # 美国英语 - Aria (女声)
    'rate': '+0%',  # 语速
    'volume': '+0%'  # 音量
}

# 线程池执行器
executor = ThreadPoolExecutor(max_workers=4)

def run_tts_sync(text, output_file):
    """同步运行TTS生成"""
    async def generate():
        communicate = edge_tts.Communicate(
            text=text,
            voice=VOICE_CONFIG['voice'],
            rate=VOICE_CONFIG['rate'],
            volume=VOICE_CONFIG['volume']
        )
        await communicate.save(output_file)

    # 在新的事件循环中运行
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        loop.run_until_complete(generate())
    finally:
        loop.close()

@app.route('/tts', methods=['GET', 'POST'])
def text_to_speech():
    """文本转语音接口"""
    try:
        # 获取文本参数
        if request.method == 'POST':
            data = request.get_json()
            text = data.get('text', '') if data else ''
        else:
            text = request.args.get('text', '')

        if not text:
            return jsonify({'error': '缺少文本参数'}), 400

        logger.info(f"TTS请求: {text}")

        # 创建临时文件
        with tempfile.NamedTemporaryFile(delete=False, suffix='.mp3') as tmp_file:
            tmp_filename = tmp_file.name

        try:
            # 在线程池中运行TTS生成
            future = executor.submit(run_tts_sync, text, tmp_filename)
            future.result(timeout=30)  # 30秒超时

            logger.info(f"TTS生成成功: {text}")

            # 返回音频文件
            return send_file(
                tmp_filename,
                mimetype='audio/mpeg',
                as_attachment=False,
                download_name=f'tts_{hash(text)}.mp3'
            )

        except Exception as e:
            logger.error(f"TTS生成失败: {e}")
            return jsonify({'error': f'TTS生成失败: {str(e)}'}), 500

        finally:
            # 清理临时文件
            try:
                if os.path.exists(tmp_filename):
                    os.unlink(tmp_filename)
            except:
                pass

    except Exception as e:
        logger.error(f"TTS服务错误: {e}")
        return jsonify({'error': f'服务错误: {str(e)}'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """健康检查接口"""
    return jsonify({'status': 'ok', 'service': 'edge-tts'})

@app.route('/voices', methods=['GET'])
def list_voices():
    """获取可用语音列表"""
    try:
        def get_voices():
            async def fetch():
                return await edge_tts.list_voices()

            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)
            try:
                return loop.run_until_complete(fetch())
            finally:
                loop.close()

        future = executor.submit(get_voices)
        voices = future.result(timeout=10)

        # 过滤英语语音
        english_voices = [
            {
                'name': voice['Name'],
                'display_name': voice['DisplayName'],
                'locale': voice['Locale'],
                'gender': voice['Gender']
            }
            for voice in voices
            if voice['Locale'].startswith('en-')
        ]
        return jsonify({'voices': english_voices})
    except Exception as e:
        logger.error(f"获取语音列表失败: {e}")
        return jsonify({'error': f'获取语音列表失败: {str(e)}'}), 500

if __name__ == '__main__':
    print("启动 Edge TTS 服务器...")
    print(f"使用语音: {VOICE_CONFIG['voice']}")
    print("访问 http://localhost:5000/health 检查服务状态")
    print("使用方法: GET /tts?text=hello 或 POST /tts {'text': 'hello'}")

    app.run(host='0.0.0.0', port=5000, debug=False)
