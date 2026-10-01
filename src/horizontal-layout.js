// Measured sibling slides share the exact available viewport width.
export function measureTrack(track, panels) {
  const width = document.documentElement.clientWidth;
  track.style.setProperty('--panel-count', panels.length);
  track.style.setProperty('--panel-width', `${width}px`);
  return { width, length: panels.length * width, travel: Math.max(0, (panels.length - 1) * width),
    boxes: panels.map((panel, index) => ({ panel, left: index * width, width })) };
}
