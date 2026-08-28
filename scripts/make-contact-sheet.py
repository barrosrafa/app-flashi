from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

root = Path('artifacts/screens')
font = ImageFont.load_default()
for viewport in ('desktop', 'mobile'):
    files = sorted(root.glob(f'{viewport}-*.png'))
    thumbs = []
    for path in files:
        image = Image.open(path).convert('RGB')
        image.thumbnail((420, 280))
        canvas = Image.new('RGB', (440, 330), '#0b1525')
        x = (440 - image.width) // 2
        canvas.paste(image, (x, 28))
        draw = ImageDraw.Draw(canvas)
        draw.text((16, 10), path.stem.replace(f'{viewport}-', '').replace('-', ' ').title(), fill='#edf5ff', font=font)
        thumbs.append(canvas)
    cols = 2
    rows = (len(thumbs) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * 440, rows * 330), '#07111f')
    for index, thumb in enumerate(thumbs):
        sheet.paste(thumb, ((index % cols) * 440, (index // cols) * 330))
    sheet.save(root / f'{viewport}-contact-sheet.png')
