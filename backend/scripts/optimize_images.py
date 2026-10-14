import os
import sys
from PIL import Image

sys.path.append(os.path.join(os.getcwd(), "backend"))
from app.core.config import settings

# Disable decompression bomb protection for processing extremely large blueprints
Image.MAX_IMAGE_PIXELS = None

def optimize_images():
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    uploads_dir = os.path.join(base_dir, settings.UPLOAD_DIR)
    if not os.path.exists(uploads_dir):
        print(f"Directory {uploads_dir} does not exist!")
        return

    print(f"Starting image optimization in {uploads_dir}...")
    count = 0
    saved_bytes = 0

    for root, _, files in os.walk(uploads_dir):
        for filename in files:
            ext = os.path.splitext(filename)[1].lower()
            if ext not in [".jpg", ".jpeg", ".png", ".webp"]:
                continue

            filepath = os.path.join(root, filename)
            try:
                original_size = os.path.getsize(filepath)
                
                # Skip if already small (e.g. less than 800 KB)
                if original_size < 800 * 1024:
                    continue

                rel_path = os.path.relpath(filepath, uploads_dir)
                print(f"Optimizing {rel_path} ({original_size / 1024 / 1024:.2f} MB)...")

                with Image.open(filepath) as img:
                    # Resize if extremely large
                    max_size = 2000
                    if img.width > max_size or img.height > max_size:
                        ratio = min(max_size / img.width, max_size / img.height)
                        new_size = (int(img.width * ratio), int(img.height * ratio))
                        print(f"  Resizing from {img.size} to {new_size}")
                        img = img.resize(new_size, Image.Resampling.LANCZOS)

                    # Convert RGBA to RGB for JPEG
                    if img.mode in ('RGBA', 'LA') or (img.mode == 'P' and 'transparency' in img.info):
                        if ext == '.png':
                            img.save(filepath, format="PNG", optimize=True)
                        else:
                            img = img.convert('RGB')
                            img.save(filepath, format="JPEG", quality=82, optimize=True)
                    else:
                        if ext == '.png':
                            img.save(filepath, format="PNG", optimize=True)
                        elif ext == '.webp':
                            img.save(filepath, format="WEBP", quality=82)
                        else:
                            img.save(filepath, format="JPEG", quality=82, optimize=True)

                new_size_bytes = os.path.getsize(filepath)
                reduction = original_size - new_size_bytes
                saved_bytes += reduction
                count += 1
                print(f"  Done. New size: {new_size_bytes / 1024 / 1024:.2f} MB (Reduced by {reduction / 1024 / 1024:.2f} MB)")
            except Exception as e:
                print(f"  Error optimizing {filename}: {e}")

    print(f"Successfully optimized {count} images. Saved {saved_bytes / 1024 / 1024:.2f} MB in total.")

if __name__ == "__main__":
    optimize_images()
