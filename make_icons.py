from PIL import Image
icon = Image.open('packages/web/public/brand/icon-mark-transparent.png').convert('RGBA')
size = 1024
bg = Image.new('RGBA', (size, size), (17,17,17,255))
icon_resized = icon.resize((680,680))
pos = ((size-680)//2, (size-680)//2)
bg.paste(icon_resized, pos, icon_resized)
bg.convert('RGB').save('packages/mobile/assets/icon.png')
bg.convert('RGB').save('packages/mobile/assets/adaptive-icon.png')
bg.convert('RGB').save('packages/mobile/assets/splash-icon.png')
small = bg.resize((196,196))
small.convert('RGB').save('packages/mobile/assets/favicon.png')
print('done')
