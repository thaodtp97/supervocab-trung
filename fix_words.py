#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Script này sẽ:
1. Đọc toàn bộ danh sách file trong thư mục `audio/`.
2. Đọc file words.json (bản gốc).
3. Giữ lại trong words.json chỉ những entry mà file audio thực sự tồn tại.
4. Chuẩn hóa đường dẫn audio: dùng đúng "audio/<汉字>.mp3".
5. Ghi ra file mới `words_fixed.json`.
"""

import os
import json

# === 1) Đường dẫn thư mục và file ===
ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
AUDIO_DIR = os.path.join(ROOT_DIR, "audio")
WORDS_JSON = os.path.join(ROOT_DIR, "words.json")
OUTPUT_JSON = os.path.join(ROOT_DIR, "words_fixed.json")

# === 2) Đọc toàn bộ tên file .mp3 trong `audio/` và tạo set chứa tên (chưa encodeURI) ===
audio_files = set()
for fname in os.listdir(AUDIO_DIR):
    if fname.lower().endswith(".mp3"):
        # Lưu tên file nguyên bản (ví dụ "主要.mp3")
        audio_files.add(fname)

# Hàm kiểm tra xem entry audioPath có tồn tại trong audio_files?
def audio_exists(audio_path):
    """
    audio_path: ví dụ "audio/主要.mp3"
    Trả về True nếu tệp trong audio_files, ngược lại False.
    """
    # Lấy phần cuối sau "audio/"
    if not audio_path.startswith("audio/"):
        return False
    fname = audio_path.split("audio/")[-1]
    return fname in audio_files

# === 3) Đọc words.json gốc, lọc chỉ các entry có audio tồn tại ===
with open(WORDS_JSON, "r", encoding="utf-8") as f:
    all_words = json.load(f)

fixed_words = []
missing = []  # danh sách hanzi mà không tìm thấy file mp3

for entry in all_words:
    audio_path = entry.get("audio", "").strip()
    if audio_exists(audio_path):
        # Chuẩn hóa đường dẫn (loại bỏ khoảng trắng hai đầu, giữ nguyên "audio/<汉字>.mp3")
        entry["audio"] = audio_path  
        fixed_words.append(entry)
    else:
        # Ghi lại hanzi hoặc audio_path bị thiếu
        missing.append(f"{entry.get('hanzi', '')} ({audio_path})")

# === 4) Ghi ra file mới ===
with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
    json.dump(fixed_words, f, ensure_ascii=False, indent=2)

# === 5) In kết quả ra console ===
print(f"Đã xử lý {len(all_words)} entries trong words.json")
print(f"  → Có {len(fixed_words)} entry tìm thấy file audio tương ứng")
print(f"  → Có {len(missing)} entry KHÔNG tìm thấy file audio")
if missing:
    print("Những mục sau bị thiếu file .mp3 trong thư mục audio/:")
    for m in missing[:20]:
        print("  •", m)
    if len(missing) > 20:
        print(f"  và còn {len(missing) - 20} mục khác…")

