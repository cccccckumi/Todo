"""生成项目原创的简洁勾选图标；图标文件已提交，普通构建无需 Python。"""
from pathlib import Path
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parents[1] / 'build'
root.mkdir(exist_ok=True)
image = Image.new('RGBA', (1024, 1024), (0, 0, 0, 0))
draw = ImageDraw.Draw(image)
draw.rounded_rectangle((42, 42, 982, 982), radius=240, fill='#3478f6')
draw.line([(275, 520), (437, 682), (755, 350)], fill='white', width=83, joint='curve')
for x, y in [(275, 520), (437, 682), (755, 350)]:
    draw.ellipse((x-41, y-41, x+41, y+41), fill='white')
image.resize((256, 256), Image.Resampling.LANCZOS).save(root / 'icon.png')
image.save(root / 'icon.ico', sizes=[(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)])
