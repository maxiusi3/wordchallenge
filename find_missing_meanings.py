#!/usr/bin/env python3
"""
查找所有词库中 meaning 为"无"的单词
"""

import json
import os
import glob

def find_missing_meanings():
    """查找所有 meaning 为"无"的单词"""
    
    # 词库文件路径
    vocab_files = glob.glob('data/renjiaoban/*.json')
    
    missing_words = {}
    
    for file_path in vocab_files:
        grade = os.path.basename(file_path).replace('.json', '')
        missing_words[grade] = []
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                
            for i, item in enumerate(data):
                if item.get('meaning') == '无':
                    missing_words[grade].append({
                        'index': i,
                        'word': item.get('word', ''),
                        'line': i + 1  # JSON数组中的位置
                    })
                    
        except Exception as e:
            print(f"处理文件 {file_path} 时出错: {e}")
    
    return missing_words

def print_missing_words(missing_words):
    """打印所有缺失释义的单词"""
    
    total_missing = 0
    
    for grade, words in missing_words.items():
        if words:
            print(f"\n=== {grade} ===")
            print(f"缺失释义的单词数量: {len(words)}")
            
            for word_info in words:
                print(f"  {word_info['index']:3d}. {word_info['word']}")
                
            total_missing += len(words)
    
    print(f"\n总计缺失释义的单词: {total_missing}")

if __name__ == '__main__':
    print("正在查找所有 meaning 为'无'的单词...")
    
    missing_words = find_missing_meanings()
    print_missing_words(missing_words)
