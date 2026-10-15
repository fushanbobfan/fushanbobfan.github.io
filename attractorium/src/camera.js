// Orthographic view of 3D points: the system's `up` axis is drawn vertically,
// yaw turns the attractor about that axis and pitch tilts it toward the viewer.

export function createCamera({ up = 2, yaw = 0.6, pitch = 0.25, zoom = 1 } = {}) {
  return { up, yaw, pitch, zoom, center: [0, 0, 0], radius: 1 };
}

// The two axes that lie in the horizontal plane, in right-handed order with up.
export function horizontalAxes(up) {
  return [(up + 1) % 3, (up + 2) % 3];
}

// Centres the camera on the bounding box and sizes it by the box's
// half-diagonal, so the whole attractor fits whichever way it is turned.
export function fitCamera(cam, box) {
  cam.center = box.center.slice();
  cam.radius = Math.max(1e-9, 0.5 * Math.hypot(box.max[0] - box.min[0], box.max[1] - box.min[1], box.max[2] - box.min[2]));
  return cam;
}

// Builds a projector for a canvas of the given size. project(x, y, z, out)
// writes screen x, screen y and depth (positive toward the viewer, in units
// of the camera radius) into out.
export function projector(cam, width, height) {
  const [h1, h2] = horizontalAxes(cam.up);
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const scale = (0.48 * Math.min(width, height) * cam.zoom) / cam.radius;
  const ox = width / 2;
  const oy = height / 2;
  const c = cam.center;
  return function project(x, y, z, out) {
    const v = [x - c[0], y - c[1], z - c[2]];
    const a = v[h1];
    const b = v[h2];
    const u = v[cam.up];
    // Yaw about the vertical axis. The second horizontal axis points into the
    // screen so the drawn frame stays right-handed and nothing is mirrored.
    const right = a * cy - b * sy;
    const toward = -(a * sy + b * cy);
    // Pitch about the screen's horizontal axis.
    const vert = u * cp - toward * sp;
    const depth = u * sp + toward * cp;
    out[0] = ox + right * scale;
    out[1] = oy - vert * scale;
    out[2] = depth / cam.radius;
    return out;
  };
}

export const PITCH_LIMIT = Math.PI / 2 - 0.01;

export function orbitCamera(cam, dx, dy, sensitivity = 0.01) {
  cam.yaw = wrapAngle(cam.yaw + dx * sensitivity);
  cam.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, cam.pitch + dy * sensitivity));
  return cam;
}

export function zoomCamera(cam, factor) {
  cam.zoom = Math.max(0.25, Math.min(12, cam.zoom * factor));
  return cam;
}

export function wrapAngle(a) {
  const t = Math.PI * 2;
  return ((((a + Math.PI) % t) + t) % t) - Math.PI;
}
