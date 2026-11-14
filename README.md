# Insta Designer

A small browser tool for making square **1080×1080 Instagram feed posts**. Add a background photo, pin your logos to the top corner, write a title and caption in a dark footer, and download the result as a PNG.

**Live demo:** https://asyahdan.github.io/Insta-designer/

## Features

- **Square 1080×1080 canvas**, ready for the Instagram feed
- **Background photo:** drop an image on the canvas or choose a file, drag to reframe it, and zoom from 100% to 300% (slider or scroll wheel)
- **Logo shape:** a white badge at the top of the post
  - Switch between **No logo** and **With logo**
  - Choose **Oval** (default) or **Square**
    - Oval is stuck into the edge. On the left and right it hangs off the corner, with the outer end cut off by the canvas edge
    - Square has classic corners, sticks to the top edge and keeps a gap from the left and right edges
  - Place it on the **left**, **middle** or **right**
  - Uploading a logo replaces the default mark
  - Add up to 8 logos, replace or remove each one
  - Sliders for the distance between logos and the logo size
  - Automatically shrinks to fit if there are too many logos
- **Footer** with the title, category and description
  - Dark red, blue or green, or no footer (the text sits on a dark fade over the photo)
  - Soft fade into the photo at the top edge
  - Transparency slider
  - The title shrinks automatically when the text gets long
- **Download as PNG** at full 1080×1080 resolution

## How to use

1. Drop a photo onto the canvas, or click **Add background**.
2. Drag the photo to frame it and zoom if needed.
3. Pick a footer color and set the transparency.
4. Type your title, category and description.
5. Turn the logo on or off, choose its shape and position, upload your logos and adjust their size and spacing.
6. Click **Download PNG**.

## Run it locally

No build step and no dependencies. Download or clone the repo and open `index.html` in your browser.

```bash
git clone https://github.com/asyahdan/Insta-designer.git
cd Insta-designer
```

## Project structure

```
Insta-designer/
├── index.html   # page layout and controls
├── styles.css   # control panel and page styling
└── app.js       # canvas drawing, layout and interactions
```

## Built with

- HTML, CSS and vanilla JavaScript
- The Canvas API for drawing and PNG export
- Google Fonts (Manrope and Sora)

## Privacy

Everything runs in your browser. Photos and logos you add are never uploaded anywhere.

## Notes

- The page loads its fonts from Google Fonts, so they need an internet connection to display correctly.
