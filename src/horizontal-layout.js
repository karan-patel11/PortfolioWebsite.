// Fixed pages: measurement depends only on viewport width and panel count.
export function measureTrack(track, panels) {
  const width = innerWidth;
  track.style.setProperty('--panel-count', panels.length);
  return { width, length: panels.length * width, travel: Math.max(0, (panels.length - 1) * width),
    boxes: panels.map((panel, index) => ({ panel, left: index * width, width })) };
}
