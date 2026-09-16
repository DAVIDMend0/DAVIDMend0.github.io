import os
import shutil
from PIL import Image, ImageOps

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MEDIA_DIR = os.path.join(BASE_DIR, "WebsiteImages")

print(f"Processing media in: {MEDIA_DIR}")

# 1. Normalize video files to lowercase .mp4
print("\n--- Normalizing Video Extensions ---")
for root, dirs, files in os.walk(MEDIA_DIR):
    for f in files:
        if f.endswith(".MP4"):
            old_path = os.path.join(root, f)
            temp_path = os.path.join(root, f[:-4] + "_temp.mp4")
            new_path = os.path.join(root, f[:-4] + ".mp4")
            os.rename(old_path, temp_path)
            os.rename(temp_path, new_path)
            print(f"Renamed video: {f} -> {os.path.basename(new_path)}")

# 2. Process and compress all images
print("\n--- Compressing Images ---")
processed_images = {}

# Map of images to process
for root, dirs, files in os.walk(MEDIA_DIR):
    for f in files:
        ext = os.path.splitext(f)[1].lower()
        if ext in (".jpg", ".jpeg", ".png") and not f.endswith("_temp"):
            base_name = os.path.splitext(f)[0]
            src_path = os.path.join(root, f)
            
            # Avoid processing generated temp files
            key = (root, base_name)
            if key not in processed_images:
                processed_images[key] = src_path

total_orig_bytes = 0
total_comp_bytes = 0

for (dir_path, base_name), src_path in processed_images.items():
    orig_size = os.path.getsize(src_path)
    total_orig_bytes += orig_size
    rel_src = os.path.relpath(src_path, BASE_DIR)
    
    with Image.open(src_path) as raw_im:
        # Transpose EXIF to bake in physical rotation
        im = ImageOps.exif_transpose(raw_im)
        
        # Determine maximum dimension
        if base_name == "ProfileMain":
            max_dim = 800
        elif base_name == "hero-bg":
            max_dim = 1920
        else:
            max_dim = 1600
        
        if im.width > max_dim or im.height > max_dim:
            im.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
        
        # Determine whether it's a photo or graphic
        is_photo = (
            os.path.splitext(src_path)[1].lower() in (".jpg", ".jpeg")
            or base_name in ("SL_House", "ProfileMain", "hero-bg")
        )
        
        # Save progressive JPEG
        jpg_path = os.path.join(dir_path, f"{base_name}.jpg")
        if is_photo:
            im_rgb = im.convert("RGB") if im.mode != "RGB" else im
            im_rgb.save(jpg_path, format="JPEG", quality=84, optimize=True, progressive=True)
            comp_size = os.path.getsize(jpg_path)
        else:
            # For pure graphics with PNG extension, optimize PNG
            png_path = os.path.join(dir_path, f"{base_name}.png")
            # If RGBA has no alpha transparency, convert to RGB
            if im.mode == "RGBA":
                alpha = im.split()[-1]
                if alpha.getextrema() == (255, 255):
                    im = im.convert("RGB")
            im.save(png_path, format="PNG", optimize=True)
            comp_size = os.path.getsize(png_path)
            
            # Also provide a JPEG alternative for large PNGs like AT_WorldFR
            if comp_size > 300 * 1024:
                im_rgb = im.convert("RGB")
                im_rgb.save(jpg_path, format="JPEG", quality=84, optimize=True, progressive=True)
        
        # Save WebP version as well (both formats available)
        webp_path = os.path.join(dir_path, f"{base_name}.webp")
        im.save(webp_path, format="WEBP", quality=82, method=6)
        
        total_comp_bytes += comp_size
        print(f"Processed {base_name}: {orig_size/1024:.1f} KB -> {comp_size/1024:.1f} KB (saved {(1 - comp_size/orig_size)*100:.1f}%)")

# Ensure hero-bg.jpg exists
hero_bg_webp = os.path.join(MEDIA_DIR, "Profile", "hero-bg.webp")
hero_bg_jpg = os.path.join(MEDIA_DIR, "Profile", "hero-bg.jpg")
if os.path.exists(hero_bg_webp) and not os.path.exists(hero_bg_jpg):
    with Image.open(hero_bg_webp) as im:
        im.convert("RGB").save(hero_bg_jpg, format="JPEG", quality=82, optimize=True, progressive=True)
    print("Created hero-bg.jpg from hero-bg.webp")

print("\n--- Compression Complete ---")
print(f"Original total size:   {total_orig_bytes / (1024*1024):.2f} MB")
print(f"Compressed total size: {total_comp_bytes / (1024*1024):.2f} MB")
print(f"Total space saved:     {(total_orig_bytes - total_comp_bytes) / (1024*1024):.2f} MB ({(1 - total_comp_bytes/total_orig_bytes)*100:.1f}%)")
