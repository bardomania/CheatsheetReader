// One-off icon generator: a terminal-prompt glyph (">_") on a dark rounded
// square, rendered as raw RGBA and PNG-encoded via zlib. No image deps needed.
const zlib = require('zlib')
const fs = require('fs')
const path = require('path')

const SIZE = 256
const BG = [27, 29, 38, 255] // dark slate
const FG = [57, 217, 138, 255] // terminal green
const RADIUS = 48

function distToSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax
  const aby = by - ay
  const apx = px - ax
  const apy = py - ay
  const abLenSq = abx * abx + aby * aby
  let t = abLenSq === 0 ? 0 : (apx * abx + apy * aby) / abLenSq
  t = Math.max(0, Math.min(1, t))
  const cx = ax + t * abx
  const cy = ay + t * aby
  return Math.hypot(px - cx, py - cy)
}

function roundedRectMask(x, y, size, radius) {
  const cx = x < radius ? radius : x > size - radius ? size - radius : x
  const cy = y < radius ? radius : y > size - radius ? size - radius : y
  if ((x < radius || x > size - radius) && (y < radius || y > size - radius)) {
    return Math.hypot(x - cx, y - cy) <= radius
  }
  return true
}

const buf = Buffer.alloc(SIZE * SIZE * 4)

// Chevron ">" strokes (two thick line segments forming a V rotated 90deg)
const chevronTop = { ax: 70, ay: 78, bx: 122, by: 128 }
const chevronBottom = { ax: 122, ay: 128, bx: 70, by: 178 }
const strokeWidth = 16

// Underscore bar
const barX1 = 138, barX2 = 196, barY1 = 158, barY2 = 174

for (let y = 0; y < SIZE; y++) {
  for (let x = 0; x < SIZE; x++) {
    const i = (y * SIZE + x) * 4
    if (!roundedRectMask(x, y, SIZE, RADIUS)) {
      buf[i + 3] = 0 // transparent outside the rounded square
      continue
    }

    let isForeground = false
    if (distToSegment(x, y, chevronTop.ax, chevronTop.ay, chevronTop.bx, chevronTop.by) <= strokeWidth / 2) {
      isForeground = true
    }
    if (distToSegment(x, y, chevronBottom.ax, chevronBottom.ay, chevronBottom.bx, chevronBottom.by) <= strokeWidth / 2) {
      isForeground = true
    }
    if (x >= barX1 && x <= barX2 && y >= barY1 && y <= barY2) {
      isForeground = true
    }

    const color = isForeground ? FG : BG
    buf[i] = color[0]
    buf[i + 1] = color[1]
    buf[i + 2] = color[2]
    buf[i + 3] = color[3]
  }
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, 'ascii')
  const lenBuf = Buffer.alloc(4)
  lenBuf.writeUInt32BE(data.length, 0)
  const crcInput = Buffer.concat([typeBuf, data])
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(crcInput), 0)
  return Buffer.concat([lenBuf, typeBuf, data, crcBuf])
}

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(width, 0)
  ihdr.writeUInt32BE(height, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // color type RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  const rawWithFilters = Buffer.alloc((width * 4 + 1) * height)
  for (let y = 0; y < height; y++) {
    const srcStart = y * width * 4
    const destStart = y * (width * 4 + 1)
    rawWithFilters[destStart] = 0 // filter type: none
    rgba.copy(rawWithFilters, destStart + 1, srcStart, srcStart + width * 4)
  }

  const idatData = zlib.deflateSync(rawWithFilters)

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', idatData),
    chunk('IEND', Buffer.alloc(0))
  ])
}

const png = encodePng(SIZE, SIZE, buf)
const outDir = path.resolve(__dirname, '../build')
fs.mkdirSync(outDir, { recursive: true })
fs.writeFileSync(path.join(outDir, 'icon.png'), png)
console.log('Wrote', path.join(outDir, 'icon.png'), png.length, 'bytes')
