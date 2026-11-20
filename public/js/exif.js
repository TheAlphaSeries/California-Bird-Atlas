// Minimal EXIF reader for JPEG files, plus display/thumbnail generation in the browser.
const TAGS = { 0x010f: 'make', 0x0110: 'model', 0x829a: 'exposure', 0x829d: 'fnumber', 0x8827: 'iso', 0x9003: 'datetime', 0x9011: 'offset', 0x920a: 'focal', 0xa405: 'focal35', 0xa434: 'lens' };

export async function readExif(file) {
  try {
    const buf = await file.slice(0, 256 * 1024).arrayBuffer();
    const v = new DataView(buf);
    if (v.getUint16(0) !== 0xffd8) return {};
    let off = 2;
    while (off + 4 < v.byteLength) {
      const marker = v.getUint16(off), size = v.getUint16(off + 2);
      if (marker === 0xffe1 && v.getUint32(off + 4) === 0x45786966) return parseTiff(v, off + 10);
      if ((marker & 0xff00) !== 0xff00) break;
      off += 2 + size;
    }
  } catch { /* unreadable metadata is not an error */ }
  return {};
}
function parseTiff(v, base) {
  const le = v.getUint16(base) === 0x4949;
  const u16 = (o) => v.getUint16(o, le), u32 = (o) => v.getUint32(o, le);
  const out = {};
  const value = (entry) => {
    const type = u16(entry + 2), count = u32(entry + 4);
    const sizes = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 10: 8 };
    const len = (sizes[type] || 1) * count;
    const at = len > 4 ? base + u32(entry + 8) : entry + 8;
    if (at + len > v.byteLength) return null;
    if (type === 2) { let s = ''; for (let i = 0; i < count - 1; i++) s += String.fromCharCode(v.getUint8(at + i)); return s.trim(); }
    if (type === 3) return u16(at);
    if (type === 4) return u32(at);
    if (type === 5 || type === 10) { const r = []; for (let i = 0; i < count; i++) { const n = type === 5 ? u32(at + i * 8) : v.getInt32(at + i * 8, le), d = type === 5 ? u32(at + i * 8 + 4) : v.getInt32(at + i * 8 + 4, le); r.push(d ? n / d : 0); } return count === 1 ? r[0] : r; }
    return null;
  };
  const walk = (ifd, gps) => {
    if (ifd + 2 > v.byteLength) return;
    const n = u16(ifd);
    for (let i = 0; i < n; i++) {
      const e = ifd + 2 + i * 12; if (e + 12 > v.byteLength) return;
      const tag = u16(e);
      if (gps) { if (tag >= 1 && tag <= 4) out['gps' + tag] = value(e); continue; }
      if (tag === 0x8769) walk(base + u32(e + 8), false);
      else if (tag === 0x8825) walk(base + u32(e + 8), true);
      else if (TAGS[tag]) out[TAGS[tag]] = value(e);
    }
  };
  walk(base + u32(base + 4), false);
  const ex = {};
  if (out.make || out.model) ex.camera = [out.make, out.model].filter(Boolean).join(' ').replace(/^(\w+) \1/i, '$1');
  if (out.lens) ex.lens = out.lens;
  if (out.focal) ex.focal_length = Math.round(out.focal) + ' mm';
  if (out.focal35) ex.focal_35mm = out.focal35 + ' mm';
  if (out.fnumber) ex.aperture = 'f/' + (+out.fnumber.toFixed(1));
  if (out.exposure) ex.shutter = out.exposure >= 1 ? out.exposure + ' s' : '1/' + Math.round(1 / out.exposure) + ' s';
  if (out.iso) ex.iso = Array.isArray(out.iso) ? out.iso[0] : out.iso;
  if (out.datetime) { const m = /^(\d{4}):(\d\d):(\d\d) (\d\d):(\d\d):(\d\d)/.exec(out.datetime); if (m) ex.taken_at = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}`; }
  const dms = (a, ref) => (Array.isArray(a) && a.length === 3 ? (a[0] + a[1] / 60 + a[2] / 3600) * (/[SW]/.test(ref || '') ? -1 : 1) : null);
  const lat = dms(out.gps2, out.gps1), lng = dms(out.gps4, out.gps3);
  if (lat !== null && lng !== null && (lat || lng)) { ex.lat = +lat.toFixed(6); ex.lng = +lng.toFixed(6); }
  return ex;
}

// Returns { display, thumb, width, height } as JPEG blobs. The original file is left untouched.
export async function derivatives(file) {
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch { throw new Error(`"${file.name}" could not be read as an image. Upload a JPEG, PNG or WebP file.`); }
  const make = async (max, q) => {
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    const ctx = c.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.drawImage(bmp, 0, 0, c.width, c.height);
    return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('Image conversion failed'))), 'image/jpeg', q));
  };
  const out = { display: await make(2560, 0.86), thumb: await make(720, 0.8), width: bmp.width, height: bmp.height };
  bmp.close?.();
  return out;
}
