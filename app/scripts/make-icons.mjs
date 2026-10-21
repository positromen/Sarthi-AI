// Renders the Sarthi chariot-wheel mark (same geometry as renderer/ui/icons.tsx `Logo`) into the PNG/ICO files the
// app needs. Run from app/: `node scripts/make-icons.mjs`. Outputs are committed; rerun only if the mark changes.
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, writeFileSync } from 'node:fs'
import pngToIco from 'png-to-ico'

const LEAF = '#4ade80'
const INK = '#0b0f0c'
const WHEEL = `
  <circle cx="12" cy="12" r="9"/>
  <circle cx="12" cy="12" r="2.2" fill="${LEAF}" stroke="none"/>
  <path d="M12 3v6.5M12 14.5V21M4.2 7.5l5.6 3.2M14.2 13.3l5.6 3.2M4.2 16.5l5.6-3.2M14.2 10.7l5.6-3.2"/>`

/** Wheel on a transparent background, for the tray. Stroke 2 keeps it open at 16 px. */
const traySvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${LEAF}"
  stroke-width="2" stroke-linecap="round">${WHEEL}</svg>`

/** Wheel on a dark rounded tile, for the app/installer icon (readable on any wallpaper). */
const appSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">
  <rect width="32" height="32" rx="7" fill="${INK}"/>
  <g transform="translate(4 4)" fill="none" stroke="${LEAF}" stroke-width="1.8" stroke-linecap="round">${WHEEL}</g></svg>`

const render = (svg, size) => new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng()

mkdirSync('resources', { recursive: true })
mkdirSync('build', { recursive: true })

// Electron's nativeImage picks tray@2x.png on 200% displays when loading tray.png.
writeFileSync('resources/tray.png', render(traySvg, 16))
writeFileSync('resources/tray@2x.png', render(traySvg, 32))
writeFileSync('resources/icon.png', render(appSvg, 256))

const icoSizes = [16, 24, 32, 48, 64, 128, 256]
writeFileSync('build/icon.ico', await pngToIco(icoSizes.map((size) => render(appSvg, size))))

console.log('Wrote resources/tray.png, resources/tray@2x.png, resources/icon.png, build/icon.ico')
