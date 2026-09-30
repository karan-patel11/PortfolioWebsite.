// Seven equal pages use the available viewport, including classic scrollbars.
export function measureTrack(track, panels) {
  const width = document.documentElement.clientWidth;
  track.style.setProperty('--panel-count', panels.length);
  track.style.setProperty('--panel-width', `${width}px`);
  return { width, length: panels.length * width, travel: Math.max(0, (panels.length - 1) * width),
    boxes: panels.map((panel, index) => ({ panel, left: index * width, width })) };
}
