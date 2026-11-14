const SIZE = 1080;
const FONT = 'Manrope, "Segoe UI", sans-serif';
const DISPLAY = 'Sora, Manrope, "Segoe UI", sans-serif';
const FOOTER_COLORS = {
  red: "#5c0e19",
  blue: "#0a2a5c",
  green: "#0a4128",
};
const FADE_HEIGHT = 120; // how far the footer fades up into the photo
const MAX_LOGOS = 8;

const canvas = document.getElementById("post");
const ctx = canvas.getContext("2d");

const state = {
  footer: "red",
  footerTransparency: 15, // 0 = solid, 100 = fully see-through
  title: "City lights after dark",
  category: "Feature",
  description: "A short line about the photo, set directly under the category.",
  logos: [{ kind: "default" }],
  logoGap: 18,
  logoSize: 100,
  bg: null,
  bgX: 0,
  bgY: 0,
  zoom: 1,
};

const els = {
  title: document.getElementById("title"),
  category: document.getElementById("category"),
  description: document.getElementById("description"),
  logoList: document.getElementById("logo-list"),
  addLogo: document.getElementById("add-logo"),
  logoFile: document.getElementById("logo-file"),
  logoGap: document.getElementById("logo-gap"),
  gapValue: document.getElementById("gap-value"),
  gapNote: document.getElementById("gap-note"),
  logoSize: document.getElementById("logo-size"),
  sizeValue: document.getElementById("size-value"),
  addBg: document.getElementById("add-bg"),
  clearBg: document.getElementById("clear-bg"),
  bgFile: document.getElementById("bg-file"),
  zoom: document.getElementById("zoom"),
  zoomValue: document.getElementById("zoom-value"),
  resetBg: document.getElementById("reset-bg"),
  download: document.getElementById("download"),
  toast: document.getElementById("toast"),
  stageNote: document.getElementById("stage-note"),
  footerAlpha: document.getElementById("footer-alpha"),
  footerAlphaValue: document.getElementById("footer-alpha-value"),
  chips: [...document.querySelectorAll(".chip")],
};

let logoTarget = null;
let drag = null;
let toastTimer = 0;

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

function toast(message) {
  els.toast.hidden = false;
  els.toast.textContent = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    els.toast.hidden = true;
  }, 3400);
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not read that image."));
    img.src = src;
  });
}

function readFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read that file."));
    reader.readAsDataURL(file);
  });
}

function wrapText(context, text, maxWidth) {
  const lines = [];
  for (const paragraph of String(text).split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      if (context.measureText(word).width > maxWidth) {
        if (line) {
          lines.push(line);
          line = "";
        }
        let chunk = "";
        for (const ch of word) {
          const next = chunk + ch;
          if (context.measureText(next).width > maxWidth && chunk) {
            lines.push(chunk);
            chunk = ch;
          } else {
            chunk = next;
          }
        }
        line = chunk;
        continue;
      }
      const test = line ? `${line} ${word}` : word;
      if (line && context.measureText(test).width > maxWidth) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
  }
  return lines;
}

function clipLines(lines, max) {
  if (lines.length <= max) return lines;
  const out = lines.slice(0, max);
  out[max - 1] = `${out[max - 1].replace(/[.\s…]+$/, "")}…`;
  return out;
}

function measureBlock(font, text, width, letterSpacing, maxLines) {
  ctx.save();
  ctx.font = font;
  ctx.letterSpacing = letterSpacing;
  const raw = text.trim() ? wrapText(ctx, text.trim(), width) : [];
  ctx.restore();
  return clipLines(raw, maxLines);
}

function shade(hex, amount) {
  const n = parseInt(hex.slice(1), 16);
  const channel = (c) => clamp(Math.round(c * amount), 0, 255);
  return `rgb(${channel((n >> 16) & 255)}, ${channel((n >> 8) & 255)}, ${channel(n & 255)})`;
}

function rgba(hex, alpha) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function computeLogos(count, logoSize, gap) {
  const maxW = SIZE - 64;
  let size = logoSize;
  let usedGap = gap;
  let padX = 0;
  let padY = 0;
  let width = 0;
  for (let i = 0; i < 24; i += 1) {
    padX = Math.max(28, Math.round(size * 0.7));
    padY = Math.max(14, Math.round(size * 0.24));
    width = padX * 2 + count * size + Math.max(0, count - 1) * usedGap;
    if (width <= maxW) break;
    if (size > 42) {
      size -= 4;
      continue;
    }
    if (count > 1 && usedGap > 0) {
      const overflow = width - maxW;
      usedGap = Math.max(0, usedGap - Math.ceil(overflow / (count - 1)));
      width = padX * 2 + count * size + (count - 1) * usedGap;
    }
    break;
  }
  return {
    size,
    gap: usedGap,
    padX,
    padY,
    width,
    height: padY * 2 + size,
  };
}

function flowText(blocks) {
  const items = [];
  let y = 0;
  for (const block of blocks) {
    if (!block.lines.length) continue;
    if (items.length) y += items[items.length - 1].gapAfter;
    items.push({ ...block, y });
    y += block.lines.length * block.lineH;
  }
  return { items, bottom: y };
}

function layout() {
  const count = Math.max(1, state.logos.length);
  const logos = computeLogos(count, state.logoSize, state.logoGap);
  const margin = 32;
  const padTop = 32;
  const padBottom = 32;

  // Logo pill: stuck into the top-left corner. Its left rounded end hangs
  // off the canvas edge (the "bleed"), so only the right end shows as an oval.
  const bleed = Math.round(logos.height / 2);
  const pill = {
    ...logos,
    bleed,
    x: -bleed,
    y: 0,
    width: logos.width + bleed,
  };

  // Footer text: full width, measured from the top of the footer band (y = 0).
  const textX = margin;
  const textW = SIZE - margin * 2;
  let titleSize = 68;
  let placed = null;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    const catSize = Math.max(20, Math.round(titleSize * 0.44));
    const descSize = Math.max(20, Math.round(titleSize * 0.42));
    const titleLH = Math.round(titleSize * 1.08);
    const catLH = Math.round(catSize * 1.28);
    const descLH = Math.round(descSize * 1.38);
    const gapTitle = Math.round(titleSize * 0.22);
    const gapCat = Math.round(catSize * 0.55);

    const blocks = [
      {
        role: "title",
        lines: measureBlock(`800 ${titleSize}px ${DISPLAY}`, state.title, textW, "0px", 4),
        lineH: titleLH,
        gapAfter: gapTitle,
        size: titleSize,
        font: `800 ${titleSize}px ${DISPLAY}`,
        spacing: "0px",
      },
      {
        role: "category",
        lines: measureBlock(`700 ${catSize}px ${FONT}`, state.category, textW, "1.4px", 2),
        lineH: catLH,
        gapAfter: gapCat,
        size: catSize,
        font: `700 ${catSize}px ${FONT}`,
        spacing: "1.4px",
      },
      {
        role: "description",
        lines: measureBlock(`560 ${descSize}px ${FONT}`, state.description, textW, "0px", 6),
        lineH: descLH,
        gapAfter: 0,
        size: descSize,
        font: `560 ${descSize}px ${FONT}`,
        spacing: "0px",
      },
    ];

    const flowed = flowText(blocks);
    // No text at all -> no footer band.
    const bandHeight = flowed.items.length ? padTop + flowed.bottom + padBottom : 0;
    // Slide the band down so it sits flush with the bottom of the canvas.
    const footerTop = SIZE - bandHeight;
    placed = {
      pill,
      textX,
      textW,
      items: flowed.items.map((item) => ({ ...item, y: item.y + footerTop + padTop })),
      footerTop,
      bandHeight,
      gapApplied: logos.gap,
      sizeApplied: logos.size,
    };

    if (bandHeight <= SIZE * 0.62 || titleSize <= 36) break;
    titleSize -= 4;
  }

  return placed;
}

function coverScale() {
  if (!state.bg) return 1;
  return Math.max(SIZE / state.bg.width, SIZE / state.bg.height);
}

function clampBackground() {
  if (!state.bg) return;
  const w = state.bg.width * coverScale() * state.zoom;
  const h = state.bg.height * coverScale() * state.zoom;
  state.bgX = clamp(state.bgX, SIZE - w, 0);
  state.bgY = clamp(state.bgY, SIZE - h, 0);
}

function centerBackground() {
  if (!state.bg) return;
  const w = state.bg.width * coverScale() * state.zoom;
  const h = state.bg.height * coverScale() * state.zoom;
  state.bgX = (SIZE - w) / 2;
  state.bgY = (SIZE - h) / 2;
  clampBackground();
}

function setZoom(next, anchorX = SIZE / 2, anchorY = SIZE / 2) {
  const zoom = clamp(next, 1, 3);
  if (!state.bg) {
    state.zoom = zoom;
    return;
  }
  const prevW = state.bg.width * coverScale() * state.zoom;
  const prevH = state.bg.height * coverScale() * state.zoom;
  const u = prevW ? (anchorX - state.bgX) / prevW : 0.5;
  const v = prevH ? (anchorY - state.bgY) / prevH : 0.5;
  state.zoom = zoom;
  const w = state.bg.width * coverScale() * state.zoom;
  const h = state.bg.height * coverScale() * state.zoom;
  state.bgX = anchorX - u * w;
  state.bgY = anchorY - v * h;
  clampBackground();
}

function drawContain(image, x, y, w, h) {
  const ir = image.width / image.height;
  const box = w / h;
  let dw;
  let dh;
  if (ir > box) {
    dw = w;
    dh = w / ir;
  } else {
    dh = h;
    dw = h * ir;
  }
  ctx.drawImage(image, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function drawDefaultMark(x, y, size) {
  const cx = x + size / 2;
  const cy = y + size / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = "#161513";
  ctx.fill();
  ctx.translate(cx, cy);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  const arm = size * 0.27;
  const waist = size * 0.075;
  ctx.moveTo(0, -arm);
  ctx.lineTo(waist, 0);
  ctx.lineTo(0, arm);
  ctx.lineTo(-waist, 0);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = Math.max(2, size * 0.045);
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.34, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawBackground() {
  if (state.bg) {
    const w = state.bg.width * coverScale() * state.zoom;
    const h = state.bg.height * coverScale() * state.zoom;
    ctx.drawImage(state.bg, state.bgX, state.bgY, w, h);
    return;
  }
  const g = ctx.createLinearGradient(0, 0, SIZE, SIZE);
  g.addColorStop(0, "#3c362f");
  g.addColorStop(0.5, "#26211c");
  g.addColorStop(1, "#141311");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, SIZE, SIZE);
}

function drawFooter(box) {
  if (!box.bandHeight) return;
  if (state.footer !== "none") {
    const color = FOOTER_COLORS[state.footer];
    const alpha = 1 - state.footerTransparency / 100;
    // The color starts invisible FADE_HEIGHT px above the footer and
    // reaches full strength where the footer (and its text) begins.
    const fadeTop = Math.max(0, box.footerTop - FADE_HEIGHT);
    const span = SIZE - fadeTop;
    const solidAt = (box.footerTop - fadeTop) / span;
    const g = ctx.createLinearGradient(0, fadeTop, 0, SIZE);
    g.addColorStop(0, rgba(color, 0));
    g.addColorStop(solidAt * 0.5, rgba(color, alpha * 0.45));
    g.addColorStop(solidAt, rgba(color, alpha));
    g.addColorStop(1, rgba(color, alpha));
    ctx.fillStyle = g;
    ctx.fillRect(0, fadeTop, SIZE, span);
    return;
  }
  // "No footer": darken the bottom of the photo so the text stays readable
  const scrimTop = Math.max(0, box.footerTop - 140);
  const scrim = ctx.createLinearGradient(0, SIZE, 0, scrimTop);
  scrim.addColorStop(0, "rgba(0,0,0,0.78)");
  scrim.addColorStop(0.72, "rgba(0,0,0,0.28)");
  scrim.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = scrim;
  ctx.fillRect(0, scrimTop, SIZE, SIZE - scrimTop);
}

function drawCopy(box) {
  const onPhoto = state.footer === "none";
  ctx.save();
  ctx.textBaseline = "top";
  ctx.textAlign = "left";
  if (onPhoto) {
    ctx.shadowColor = "rgba(0,0,0,0.55)";
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 2;
  }
  for (const item of box.items) {
    ctx.font = item.font;
    ctx.letterSpacing = item.spacing;
    if (item.role === "title") ctx.fillStyle = "#ffffff";
    else if (item.role === "category") ctx.fillStyle = "rgba(255,255,255,0.82)";
    else ctx.fillStyle = "rgba(255,255,255,0.96)";
    item.lines.forEach((line, index) => {
      ctx.fillText(line, box.textX, item.y + index * item.lineH);
    });
  }
  ctx.restore();
}

function drawPill(box) {
  const { pill } = box;
  const radius = pill.height / 2;
  ctx.save();
  ctx.shadowColor = "rgba(0,0,0,0.18)";
  ctx.shadowBlur = 18;
  ctx.shadowOffsetY = 8;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.roundRect(pill.x, pill.y, pill.width, pill.height, radius);
  ctx.fill();
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.roundRect(pill.x, pill.y, pill.width, pill.height, radius);
  ctx.clip();
  const y = pill.y + pill.padY;
  state.logos.forEach((logo, index) => {
    const x = pill.x + pill.bleed + pill.padX + index * (pill.size + pill.gap);
    if (logo.kind === "image" && logo.img) drawContain(logo.img, x, y, pill.size, pill.size);
    else drawDefaultMark(x, y, pill.size);
  });
  ctx.restore();
}

function draw() {
  const box = layout();
  ctx.clearRect(0, 0, SIZE, SIZE);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  drawBackground();
  drawFooter(box);
  drawCopy(box);
  drawPill(box);
  syncGapNote(box);
  return box;
}

function syncGapNote(box) {
  const tightened = box.gapApplied !== state.logoGap || box.sizeApplied !== state.logoSize;
  els.gapNote.hidden = !tightened;
  if (!tightened) return;
  const bits = [];
  if (box.sizeApplied !== state.logoSize) bits.push(`logo size ${box.sizeApplied}px`);
  if (box.gapApplied !== state.logoGap) bits.push(`distance ${box.gapApplied}px`);
  els.gapNote.textContent = `Adjusted to fit the post width: ${bits.join(", ")}.`;
}

function syncFooter() {
  for (const chip of els.chips) {
    const on = chip.dataset.footer === state.footer;
    chip.classList.toggle("is-on", on);
    chip.setAttribute("aria-pressed", on ? "true" : "false");
  }
  els.footerAlpha.disabled = state.footer === "none";
  els.footerAlpha.value = String(state.footerTransparency);
  els.footerAlphaValue.textContent = `${state.footerTransparency}%`;
}

function syncBackgroundControls() {
  const ready = Boolean(state.bg);
  els.zoom.disabled = !ready;
  els.resetBg.disabled = !ready;
  els.clearBg.hidden = !ready;
  els.zoom.value = String(Math.round(state.zoom * 100));
  els.zoomValue.textContent = `${Math.round(state.zoom * 100)}%`;
  canvas.classList.toggle("can-pan", ready);
  els.stageNote.textContent = ready
    ? "Drag the photo to position it. Scroll to zoom."
    : "Add a background, then drag on the post to frame it.";
}

function renderLogos() {
  els.logoList.replaceChildren();
    state.logos.forEach((logo, index) => {
    const slot = document.createElement("div");
    slot.className = "logo-slot";
    const replace = document.createElement("button");
    replace.type = "button";
    replace.className = "logo-main";
    replace.title = "Replace logo";
    replace.setAttribute("aria-label", `Replace logo ${index + 1}`);
    if (logo.kind === "image") {
      const img = document.createElement("img");
      img.src = logo.src;
      img.alt = "";
      replace.append(img);
    } else {
      const mark = document.createElement("span");
      mark.className = "mark";
      mark.setAttribute("aria-hidden", "true");
      replace.append(mark);
    }
    replace.addEventListener("click", () => pickLogo(index));
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "logo-x";
    remove.textContent = "×";
    remove.setAttribute("aria-label", `Remove logo ${index + 1}`);
    remove.addEventListener("click", () => removeLogo(index));
    slot.append(replace, remove);
    els.logoList.append(slot);
  });
  els.addLogo.disabled = state.logos.length >= MAX_LOGOS;
  els.addLogo.textContent = state.logos.length >= MAX_LOGOS ? "Logo limit reached" : "Add logo";
}

function removeLogo(index) {
  state.logos.splice(index, 1);
  if (!state.logos.length) state.logos.push({ kind: "default" });
  renderLogos();
  draw();
}

function pickLogo(index) {
  logoTarget = index;
  els.logoFile.value = "";
  els.logoFile.click();
}

async function addLogoFile(file, index) {
  if (!file || !file.type.startsWith("image/")) {
    toast("Choose an image file for the logo.");
    return;
  }
  try {
    const src = await readFile(file);
    const img = await loadImage(src);
    const entry = { kind: "image", img, src };
    if (index == null) state.logos.push(entry);
    else state.logos[index] = entry;
    renderLogos();
    draw();
  } catch (error) {
    toast(error.message);
  }
}

async function setBackgroundFile(file) {
  if (!file || !file.type.startsWith("image/")) {
    toast("Choose an image file for the background.");
    return;
  }
  try {
    const src = await readFile(file);
    const img = await loadImage(src);
    state.bg = img;
    state.zoom = 1;
    centerBackground();
    syncBackgroundControls();
    draw();
  } catch (error) {
    toast(error.message);
  }
}

function clearBackground() {
  state.bg = null;
  state.zoom = 1;
  state.bgX = 0;
  state.bgY = 0;
  syncBackgroundControls();
  draw();
}

function canvasPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * SIZE,
    y: ((event.clientY - rect.top) / rect.height) * SIZE,
  };
}

function bind() {
  for (const chip of els.chips) {
    chip.addEventListener("click", () => {
      state.footer = chip.dataset.footer;
      syncFooter();
      draw();
    });
  }

  els.footerAlpha.addEventListener("input", () => {
    state.footerTransparency = Number(els.footerAlpha.value);
    syncFooter();
    draw();
  });

  els.title.addEventListener("input", () => {
    state.title = els.title.value;
    draw();
  });
  els.category.addEventListener("input", () => {
    state.category = els.category.value;
    draw();
  });
  els.description.addEventListener("input", () => {
    state.description = els.description.value;
    draw();
  });

  els.addLogo.addEventListener("click", () => {
    if (state.logos.length >= MAX_LOGOS) return;
    pickLogo(null);
  });
  els.logoFile.addEventListener("change", () => {
    const file = els.logoFile.files && els.logoFile.files[0];
    const index = logoTarget;
    logoTarget = null;
    if (file) addLogoFile(file, index);
  });

  els.logoGap.addEventListener("input", () => {
    state.logoGap = Number(els.logoGap.value);
    els.gapValue.textContent = String(state.logoGap);
    draw();
  });
  els.logoSize.addEventListener("input", () => {
    state.logoSize = Number(els.logoSize.value);
    els.sizeValue.textContent = String(state.logoSize);
    draw();
  });

  els.addBg.addEventListener("click", () => els.bgFile.click());
  els.bgFile.addEventListener("change", () => {
    const file = els.bgFile.files && els.bgFile.files[0];
    if (file) setBackgroundFile(file);
  });
  els.clearBg.addEventListener("click", clearBackground);
  els.resetBg.addEventListener("click", () => {
    state.zoom = 1;
    centerBackground();
    syncBackgroundControls();
    draw();
  });
  els.zoom.addEventListener("input", () => {
    const point = { x: SIZE / 2, y: SIZE / 2 };
    setZoom(Number(els.zoom.value) / 100, point.x, point.y);
    syncBackgroundControls();
    draw();
  });

  els.download.addEventListener("click", () => {
    try {
      draw();
      const link = document.createElement("a");
      link.download = "instagram-post-1080.png";
      link.href = canvas.toDataURL("image/png");
      link.click();
    } catch (error) {
      toast("Could not export this post. Try a different image.");
    }
  });

  canvas.addEventListener("pointerdown", (event) => {
    if (!state.bg || event.button !== 0) return;
    drag = {
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      bgX: state.bgX,
      bgY: state.bgY,
    };
    canvas.setPointerCapture(event.pointerId);
    canvas.classList.add("is-dragging");
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!drag || drag.id !== event.pointerId) return;
    const rect = canvas.getBoundingClientRect();
    const scale = rect.width / SIZE;
    state.bgX = drag.bgX + (event.clientX - drag.x) / scale;
    state.bgY = drag.bgY + (event.clientY - drag.y) / scale;
    clampBackground();
    draw();
  });

  const endDrag = (event) => {
    if (!drag || (event && drag.id !== event.pointerId)) return;
    drag = null;
    canvas.classList.remove("is-dragging");
  };
  canvas.addEventListener("pointerup", endDrag);
  canvas.addEventListener("pointercancel", endDrag);

  canvas.addEventListener(
    "wheel",
    (event) => {
      if (!state.bg) return;
      event.preventDefault();
      const point = canvasPoint(event);
      const delta = event.deltaY > 0 ? -0.06 : 0.06;
      setZoom(state.zoom + delta, point.x, point.y);
      syncBackgroundControls();
      draw();
    },
    { passive: false }
  );

  const takePhoto = (event) => {
    event.preventDefault();
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (file) setBackgroundFile(file);
  };
  canvas.addEventListener("dragover", (event) => event.preventDefault());
  canvas.addEventListener("drop", takePhoto);

  els.logoList.addEventListener("dragover", (event) => event.preventDefault());
  els.logoList.addEventListener("drop", (event) => {
    event.preventDefault();
    const file = event.dataTransfer && event.dataTransfer.files && event.dataTransfer.files[0];
    if (!file) return;
    if (state.logos.length >= MAX_LOGOS) {
      toast("You can add up to 8 logos.");
      return;
    }
    addLogoFile(file, null);
  });
}

bind();
syncFooter();
syncBackgroundControls();
renderLogos();
draw();
document.fonts.ready.then(() => draw());
