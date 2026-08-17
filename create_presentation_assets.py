from pathlib import Path
from PIL import Image

source = Path('/home/ubuntu/open-order-control/executive_materials/assets/open_order_control_dashboard_completo.png')
out = Path('/home/ubuntu/open-order-control/presentation_diretoria_modelo/assets')
out.mkdir(parents=True, exist_ok=True)

img = Image.open(source)
# The dashboard is a tall operational canvas; these crops isolate the executive story.
crops = {
    'dashboard_executive.png': (0, 0, 1440, 900),
    'dashboard_alerts_branches.png': (0, 820, 1440, 2180),
    'dashboard_queue_base.png': (2050, 2180, 1440, 3540),
}
for name, box in crops.items():
    if box[2] <= box[0] or box[3] <= box[1]:
        raise ValueError(f'Invalid crop for {name}: {box}')
    img.crop(box).save(out / name, optimize=True)

# Reuse the existing evidence images in a presentation-local asset directory.
for name in ['manual_base_operacional.png', 'manual_relatorios.png', 'logistics_control_room.jpg']:
    src = Path('/home/ubuntu/open-order-control/executive_materials/assets') / name
    dst = out / name
    dst.write_bytes(src.read_bytes())
print(f'Created {len(crops)} dashboard crops and copied 3 supporting assets to {out}')
