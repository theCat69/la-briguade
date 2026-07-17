---
name: read-image 
description: guidance to read images in a lightweight fashion using cwebp
agents:
  - orchestrator 
  - ask
  - coder
  - builder
permission:
  bash:
    "cwebp *": "allow"
---

# Read image skill 

## Prerequist

You need to have access to cwebp to use this skill try :

```sh
cwebp --help
```

if cwebp is unavailable then read image like you would normaly do.

## How to read an image

If the image is in an uncompressed format DON'T READ IT.
Only read/analyze image in .jpg, .jpeg or .webp.

If you need to read an image in another format, then, transform it to webp first using cwebp :
```sh
cwebp <image_file_name>.png -o <image_file_name>.webp -m 6
```

Then read the resulting .webp image.

