#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
修复所有词库文件中meaning为"无"的词条
"""

import json
import os
import glob

# 词条的正确中文释义映射
MEANING_CORRECTIONS = {
    # Grade 4
    "maths book": "数学书",
    "teacher's office": "教师办公室",
    "music class": "音乐课",
    "PE class": "体育课",
    
    # Grade 5
    "sing English songs": "唱英文歌",
    "play the pipa": "弹琵琶",
    "do kung fu": "练功夫",
    "draw cartoons": "画卡通",
    "we will": "我们将",
    "are not": "不是",
    "clean my room": "打扫我的房间",
    "take a dancing class": "上舞蹈课",
    "doing morning exercises": "做早操",
    "having ... class": "上...课",
    "eating lunch": "吃午饭",
    "reading a book": "读书",
    "listening to music": "听音乐",
    "keep your desk clean": "保持你的桌子整洁",
    "talk quietly": "安静地说话",
    
    # Grade 6
    "went camping": "去野营",
    "went fishing": "去钓鱼",
    
    # Grade 7
    "play the drums": "打鼓",
    "between ... and ...": "在...和...之间",
    "follow the rules": "遵守规则",
    "be in great danger": "处于极大危险中",
    "read a newspaper": "看报纸",
    "make soup": "做汤",
    "on a vacation": "在度假",
    "go along the street": "沿着街道走",
    "enjoy reading": "喜欢阅读",
    "of medium height": "中等身高",
    "be of medium height": "中等身高",
    "take one's order": "点菜",
    "one bowl of ...": "一碗...",
    "one large bowl of ...": "一大碗...",
    "get popular": "变得受欢迎",
    "bring good luck to ...": "给...带来好运",
    "milk a cow": "挤牛奶",
    "feed chickens": "喂鸡",
    "get a surprise": "得到惊喜",
    
    # Grade 8
    "Huangguoshu Waterfall": "黄果树瀑布",
    "Weld Quay": "韦尔德码头",
    "Penang Hill": "槟城山",
    "American Teenager": "美国青少年",
    "America's Got Talent": "美国达人秀",
    "China's Got Talent": "中国达人秀",
    "Steamboat Willie": "汽船威利",
    "the Hollywood Walk of Fame": "好莱坞星光大道",
    "take breaks": "休息",
    "Aron Ralston": "阿伦·拉尔斯顿",
    "take out the rubbish": "倒垃圾",
    "Animal Helpline": "动物求助热线",
    "Junko Tabei": "田部井淳子",
    "the Ming Dynasty": "明朝",
    "the Ming Great Wall": "明长城",
    "the Amazon River": "亚马逊河",
    "Chengdu Research Base": "成都研究基地",
    "Garth Brooks": "加思·布鲁克斯",
    "Country Music Hall of Fame Museum": "乡村音乐名人堂博物馆",
    "tea art": "茶艺",
    "International Museum of Toilets": "国际厕所博物馆",
    "Hangzhou National Tea Museum": "杭州国家茶叶博物馆",
    "Disney Cruise": "迪士尼邮轮",
    "the Terracotta Army": "兵马俑",
    "the Bird's Nest": "鸟巢",
    "Night Safari": "夜间野生动物园",
    
    # Grade 9
    "Water Festival": "泼水节",
    "China Basketball Association": "中国篮球协会",
    "Whitcomb Judson": "惠特科姆·贾德森",
    "Thomas Watson": "托马斯·沃森",
    "George Crum": "乔治·克拉姆",
    "make one's own decision": "做自己的决定",
    "J.K.Rowling": "J.K.罗琳",
    "Paul Stoker": "保罗·斯托克",
    "Kung Fu Panda": "功夫熊猫",
    "Dan Dervish": "丹·德维什",
    "make ... feel at home": "让...感到宾至如归",
    "Teresa Lopez": "特蕾莎·洛佩兹",
    "Marc LeBlanc": "马克·勒布朗",
    "look back at": "回顾"
}

def fix_missing_meanings():
    """修复所有词库文件中meaning为"无"的词条"""
    
    # 获取所有词库文件
    json_files = glob.glob("data/renjiaoban/*.json")
    
    total_fixed = 0
    
    for file_path in json_files:
        grade = os.path.basename(file_path).replace('.json', '')
        print(f"\n处理 {grade}...")
        
        try:
            # 读取文件
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            fixed_count = 0
            
            # 修复meaning为"无"的词条
            for i, word in enumerate(data):
                if word.get('meaning') == '无':
                    # 尝试从映射中找到正确的释义
                    english_word = word.get('word', '') or word.get('english', '')
                    
                    if english_word in MEANING_CORRECTIONS:
                        old_meaning = word['meaning']
                        word['meaning'] = MEANING_CORRECTIONS[english_word]
                        print(f"  修复: {english_word} -> {word['meaning']}")
                        fixed_count += 1
                    else:
                        print(f"  警告: 未找到 '{english_word}' 的释义映射")
            
            # 如果有修复，保存文件
            if fixed_count > 0:
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump(data, f, ensure_ascii=False, indent=2)
                print(f"  {grade} 修复了 {fixed_count} 个词条")
                total_fixed += fixed_count
            else:
                print(f"  {grade} 没有需要修复的词条")
                
        except Exception as e:
            print(f"处理文件 {file_path} 时出错: {e}")
    
    print(f"\n总计修复了 {total_fixed} 个词条")

def verify_fixes():
    """验证修复结果"""
    print("\n验证修复结果...")
    
    json_files = glob.glob("data/renjiaoban/*.json")
    remaining_issues = 0
    
    for file_path in json_files:
        grade = os.path.basename(file_path).replace('.json', '')
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            issues = []
            for i, word in enumerate(data):
                if word.get('meaning') == '无':
                    issues.append(word.get('word', '') or word.get('english', ''))
            
            if issues:
                print(f"  {grade}: 仍有 {len(issues)} 个未修复的词条")
                for issue in issues:
                    print(f"    - {issue}")
                remaining_issues += len(issues)
            else:
                print(f"  {grade}: ✓ 所有词条已修复")
                
        except Exception as e:
            print(f"验证文件 {file_path} 时出错: {e}")
    
    if remaining_issues == 0:
        print("\n✓ 所有词条都已成功修复！")
    else:
        print(f"\n⚠ 仍有 {remaining_issues} 个词条需要手动处理")

if __name__ == "__main__":
    print("开始修复词库中meaning为'无'的词条...")
    fix_missing_meanings()
    verify_fixes()
