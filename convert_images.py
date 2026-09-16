import os
from PIL import Image

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MEDIA_DIR = os.path.join(BASE_DIR, "WebsiteImages")

EXTENSIONS = {".jpg", ".jpeg", ".png"}

total_orig_size = 0
total_webp_size = 0
converted_count = 0

print(f"Scanning {MEDIA_DIR} for images...")

for root, _, files in os.walk(MEDIA_DIR):
    for filename in files:
        name, ext = os.path.splitext(filename)
        if ext.lower() in EXTENSIONS:
            orig_path = os.path.join(root, filename)
            webp_path = os.path.join(root, f"{name}.webp")
            
            orig_size = os.path.getsize(orig_path)
            total_orig_size += orig_size
            
            try:
                with Image.open(orig_path) as im:
                    # Convert RGBA/P to RGB if saving with JPEG-style quality unless alpha needed
                    # WebP supports alpha, but RGBA mode is best preserved as is
                    if im.mode in ("P", "LA"):
                        im = im.convert("RGBA")
                    
                    # Resize if greater than 1600px
                    max_dim = 1600
                    if im.width > max_dim or im.height > max_dim:
                        im.thumbnail((max_dim, max_dim), Image.Resampling.LANCZOS)
                    
                    im.save(webp_path, "WEBP", quality=82, method=6)
                
                webp_size = os.path.getsize(webp_path)
                total_webp_size += webp_size
                converted_count += 1
                
                savings = (1 - (webp_size / orig_size)) * 100
                rel_path = os.path.relpath(webp_path, BASE_DIR)
                print(f"Converted: {rel_path} | {orig_size/1024:.1f} KB -> {webp_size/1024:.1f} KB ({savings:.1f}% saved)")
            except Exception as e:
                print(f"Error converting {orig_path}: {e}")

print("\n--- Summary ---")
print(f"Total files converted: {converted_count}")
print(f"Original size: {total_orig_size / (1024*1024):.2f} MB")
print(f"WebP size:     {total_webp_size / (1024*1024):.2f} MB")
if total_orig_size > 0:
    total_savings = (1 - (total_webp_size / total_orig_size)) * 100
    print(f"Total savings: {total_savings:.2f}% (Saved {(total_orig_size - total_webp_size)/(1024*1024):.2f} MB)")
