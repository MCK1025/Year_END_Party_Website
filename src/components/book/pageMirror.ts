export type PaperSlice = { width: number; height: number; offset: number; left: number; top: number };
export function visiblePaper(paper: HTMLElement): PaperSlice {
  const bounds = paper.getBoundingClientRect();
  const viewport = window.visualViewport;
  const top = Math.max(bounds.top, viewport?.offsetTop ?? 0);
  const bottom = Math.min(bounds.bottom, (viewport?.offsetTop ?? 0) + (viewport?.height ?? innerHeight));
  return {
    width: Math.round(bounds.width),
    height: Math.max(0, Math.round(bottom - top)),
    offset: top - bounds.top,
    left: bounds.left,
    top,
  };
}
const unavailable =
  'canvas,video,iframe,dialog[open],input[type="password"],[data-private],[aria-busy="true"]';
const omit = 'script,style,link,dialog,template,input[type="hidden"],[hidden]';
function paintControl(original: HTMLElement, copy: HTMLElement) {
  const style = getComputedStyle(original);
  for (const property of style) copy.style.setProperty(property, style.getPropertyValue(property));
  copy.style.margin = style.margin;
  copy.style.pointerEvents = "none";
  copy.style.boxSizing = "border-box";
}
function controlMark(check: boolean) {
  const ns = "http://www.w3.org/2000/svg",
    svg = document.createElementNS(ns, "svg"),
    path = document.createElementNS(ns, "path");
  svg.setAttribute("viewBox", "0 0 16 16");
  svg.setAttribute("width", check ? "17" : "12");
  svg.setAttribute("height", check ? "17" : "12");
  path.setAttribute("d", check ? "M2.2 8.6 6.2 12.1 13.8 3.1" : "M3.5 6.1 8 10.6 12.5 6.1");
  path.setAttribute("fill", "none");
  path.setAttribute("stroke", check ? "#fff" : "#242b35");
  path.setAttribute("stroke-width", check ? "3" : "2.5");
  path.setAttribute("stroke-linecap", "round");
  path.setAttribute("stroke-linejoin", "round");
  svg.append(path);
  return svg;
}
function control(el: HTMLTextAreaElement | HTMLSelectElement | HTMLInputElement) {
  const box = document.createElement("div");
  paintControl(el, box);
  if (el instanceof HTMLSelectElement) {
    box.textContent = el.selectedOptions[0]?.text ?? "";
    box.classList.add("turn-select");
    // Native select clips children to its content box; the mirrored indicator sits in the end padding.
    box.style.overflow = "visible";
    box.style.setProperty("overflow-clip-margin", "0px");
    box.append(controlMark(false));
    box.style.position = "relative";
    box.style.appearance = "none";
  } else if (el instanceof HTMLInputElement && (el.type === "checkbox" || el.type === "radio")) {
    box.classList.add("turn-check");
    box.style.appearance = "none";
    box.style.background = el.checked ? "var(--navy)" : "var(--ivory)";
    box.style.border = "1px solid var(--muted)";
    box.style.color = "white";
    if (el.checked) {
      box.dataset.checked = "true";
      box.append(controlMark(true));
    }
  } else {
    box.style.whiteSpace = el instanceof HTMLTextAreaElement ? "pre-wrap" : "pre";
    box.style.overflow = "hidden";
    box.style.resize = "none";
    const text = document.createElement("div");
    text.style.transform = `translate(${-el.scrollLeft}px,${-el.scrollTop}px)`;
    text.textContent = el.value || el.placeholder;
    box.append(text);
  }
  return box;
}
// Only recreate the visible, already-authorized paper. Offscreen branches keep their layout footprint.
export function mirrorPaper(paper: HTMLElement, slice: PaperSlice) {
  if (!slice.width || !slice.height || paper.querySelector(unavailable)) return null;
  const limit = 480;
  let count = 0;
  let raster = document.fonts?.status === "loaded";
  function copy(node: Node): Node | null {
    if (++count > limit) throw new RangeError("paper complexity");
    if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.textContent ?? "");
    if (!(node instanceof Element) || node.matches(omit)) return null;
    if (node.tagName === "BR") return document.createElement("br");
    if (getComputedStyle(node).visibility !== "visible") return null;
    const rect = node.getBoundingClientRect();
    if (node !== paper && (!rect.width || !rect.height) && getComputedStyle(node).display !== "contents")
      return null;
    if (node !== paper && (rect.bottom <= slice.top || rect.top >= slice.top + slice.height)) {
      const spacer = document.createElement("div");
      const style = getComputedStyle(node);
      Object.assign(spacer.style, {
        height: `${rect.height}px`,
        width: style.width,
        margin: style.margin,
        flex: style.flex,
        display: style.display,
        visibility: "hidden",
      });
      return spacer;
    }
    if (
      node instanceof HTMLInputElement ||
      node instanceof HTMLTextAreaElement ||
      node instanceof HTMLSelectElement
    )
      return control(node);
    if (node instanceof HTMLImageElement) {
      if (!node.complete || !node.naturalWidth) throw new Error("image pending");
      raster = false;
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(Math.min(rect.width, 1400)));
      canvas.height = Math.max(1, Math.round(Math.min(rect.height, 1000)));
      paintControl(node, canvas);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("image unavailable");
      ctx.drawImage(node, 0, 0, canvas.width, canvas.height);
      return canvas;
    }
    const isSvg = node.namespaceURI === "http://www.w3.org/2000/svg";
    if (
      !isSvg &&
      !/^(SECTION|DIV|P|HEADER|FOOTER|H[1-6]|SPAN|FORM|LABEL|BUTTON|A|OL|UL|LI|BR|STRONG|EM|BLOCKQUOTE|ARTICLE|ASIDE|TIME|FIELDSET|LEGEND|B|HR|MAIN|DL|DD|DT|FIGURE|FIGCAPTION)$/.test(
        node.tagName,
      )
    )
      throw new Error("unsupported element");
    const tag = ["FORM", "LABEL", "A"].includes(node.tagName) ? "div" : node.localName;
    const result = isSvg ? document.createElementNS(node.namespaceURI, tag) : document.createElement(tag);
    for (const attr of node.attributes) {
      if (
        attr.name === "class" ||
        (attr.name === "style" && !/url\s*\(/i.test(attr.value)) ||
        (isSvg &&
          /^(d|viewBox|width|height|fill|stroke|stroke-width|stroke-linecap|stroke-linejoin|points|cx|cy|r|x|y|x1|x2|y1|y2|transform)$/i.test(
            attr.name,
          ))
      )
        result.setAttribute(attr.name, attr.value);
    }
    if (result instanceof HTMLButtonElement) {
      result.type = "button";
      result.disabled = node instanceof HTMLButtonElement && node.disabled;
    }
    for (const child of node.childNodes) {
      const c = copy(child);
      if (c) result.append(c);
    }
    return result;
  }
  try {
    const replica = copy(paper);
    if (!(replica instanceof HTMLElement)) return null;
    const clip = document.createElement("div");
    clip.className = "turn-window";
    clip.inert = true;
    clip.setAttribute("aria-hidden", "true");
    Object.assign(clip.style, { width: `${slice.width}px`, height: `${slice.height}px` });
    replica.classList.add("paper-replica");
    Object.assign(replica.style, {
      width: `${slice.width}px`,
      position: "absolute",
      top: `${-slice.offset}px`,
      left: "0",
      transform: "none",
      minHeight: `${slice.offset + slice.height}px`,
    });
    clip.append(replica);
    return { clip, raster };
  } catch {
    return null;
  }
}
