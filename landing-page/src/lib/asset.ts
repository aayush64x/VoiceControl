// Public files (images, video, the 3D scene) live under the site's base path.
// On GitHub Pages the site is served from /voya/, so "/media/x.png"
// must become "/voya/media/x.png". Next adds the base path to its own
// files automatically, but not to plain <img>/<video> URLs: use asset() for those.
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function asset(path: string): string {
  return `${BASE_PATH}${path}`;
}
