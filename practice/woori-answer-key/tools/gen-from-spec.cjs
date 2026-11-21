#!/usr/bin/env node
// spec/*.json 에서 프론트엔드 표/하네스 레지스트리를 만든다.
//
//   node tools/gen-from-spec.cjs            # frontend/src/WooriArt.ts + WooriArtbox.ts 생성 (+ 에셋 파일 존재·크기 검사)
//   node tools/gen-from-spec.cjs --shots    # + tools/shots.json 을 spec 상태 목록으로 다시 만든다
//                                           #   (+ spec/timeline.md 의 기준 구간 표 — 같은 값)
//   node tools/gen-from-spec.cjs --check    # 파일은 쓰지 않고 검사만: 에셋 누락/남는 파일/크기 불일치,
//                                           #   WooriArt.ts·WooriArtbox.ts·shots.json·timeline 표가 지금 spec 으로 만든 것과 같은지, D1 변환
//   --root DIR                              # 다른 트리 (DIR/spec, DIR/frontend, DIR/tools/shots.json). selftest 가 쓴다
//
// 빈 상태: spec 이 없으면 빈 표·빈 shots.json. frontend/src 가 아직 없으면 TS 두 파일은 건너뛴다 (--check 도 SKIP).
//   spec/timeline.md 가 없거나 표시 줄이 없으면 표는 건너뛴다 (알림만).
//
// 단위 (D1, tools/woori-units.cjs): spec/*.assets.json 의 frameBox 는 영상 frame px (524x1280, 화면 절대).
//   WooriArtbox.ts 는 dp: x = 180 + (x_px − 262.02)/1.45803, y = y_px × 0.6875 (화면 위끝 기준), w = w_px/1.45803, h = h_px × 0.6875.
//   원본 frame px 도 `frame` 필드로 남긴다 (도구용).
// 에셋 파일: frontend/public/woori/<그룹>/… (spec 의 file: 'woori/<그룹>/<이름>.png|svg'). 이름 = '<그룹>.<spec 의 name>'.
//   PNG 는 frame px 박스 × scale(기본 3, 업스케일) 크기여야 한다. SVG 는 크기 검사 없음.
//   "character": true = 캐릭터(마스코트) 자리의 독창적 대체 그림 → 그 박스를 비교 마스크로 그 상태 shots 항목에 넣는다 (BRIEF D4).
//   "referenceOnly": "<이유>" = 영상 대조용으로만 둔 에셋 (화면 코드가 쓰면 실패).
// shots.json 항목: spec 상태마다 {"id","video","i0","i1","t0","t1","mask","refFrame"} → name '<group>/<id>', url
//   '<route>?frame=1&shot=<id>' (route = 상태 route > 스펙 route > 그룹 기본), scenario (상태/스펙 scenario > 영상 시각 규칙, shots-lib.cjs).
//   refFrame 이 tools/ref/<group>/<id>.png 가 아닌 상태(다른 상태 ref 재사용)는 넣지 않는다.
// 이 스크립트는 spec/ 와 tools/ref 의 숫자(pts·구간)만 읽는다 (개인정보 없음).
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const U = require('./woori-units.cjs')
const { scenarioFor, checkScenario } = require('./shots-lib.cjs')

const argv = process.argv.slice(2)
const argOf = (k) => {
  const i = argv.indexOf(k)
  return i >= 0 ? argv[i + 1] : undefined
}
const ROOT = path.resolve(argOf('--root') || path.dirname(__dirname))
const SPEC = path.join(ROOT, 'spec')
const PUBLIC = path.join(ROOT, 'frontend', 'public')
const SRC = path.join(ROOT, 'frontend', 'src')
const TOOLS_DIR = path.join(ROOT, 'tools')
const SHOTS = path.join(TOOLS_DIR, 'shots.json')
const TIMELINE = path.join(SPEC, 'timeline.md')
const CHECK_ONLY = argv.includes('--check')
const WITH_SHOTS = argv.includes('--shots')
const HAS_SRC = fs.existsSync(SRC)

const readJson = (p) => JSON.parse(fs.readFileSync(p, 'utf8'))
const roundT = (v) => Math.round(v * 1e6) / 1e6 // 시각(초): 원본 pts 정밀도 유지
const q = (s) => JSON.stringify(s)
const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/')

/** PNG IHDR → { w, h, alpha } (color type 4/6 = 알파 채널 있음) */
function pngInfo(file) {
  const fd = fs.openSync(file, 'r')
  const buf = Buffer.alloc(33)
  fs.readSync(fd, buf, 0, 33, 0)
  fs.closeSync(fd)
  if (buf.readUInt32BE(0) !== 0x89504e47) throw new Error(`not a PNG: ${file}`)
  const colorType = buf[25]
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), alpha: colorType === 4 || colorType === 6 }
}

/** spec 파일들: 화면 스펙(states 가 있는 *.json) 과 에셋 표(*.assets.json) */
function listSpecs() {
  if (!fs.existsSync(SPEC)) return { screens: [], assets: [] }
  const names = fs.readdirSync(SPEC).filter((f) => f.endsWith('.json')).sort()
  const screens = []
  const assets = []
  for (const f of names) {
    const file = path.join(SPEC, f)
    if (f.endsWith('.assets.json')) assets.push({ base: f.slice(0, -'.assets.json'.length), file })
    else {
      let d
      try {
        d = readJson(file)
      } catch (e) {
        throw new Error(`[gen] spec/${f} 읽기 실패: ${e.message}`)
      }
      if (d && Array.isArray(d.states)) screens.push({ base: f.slice(0, -5), file, d })
    }
  }
  return { screens, assets }
}
const { screens, assets: assetFiles } = listSpecs()
const groupOfBase = new Map(screens.map((s) => [s.base, s.d.group || s.base]))

/* ───────────────────────── 1. 에셋 표 ───────────────────────── */

const entries = []
const missing = []
const seen = new Map()
const asBox = (b) => (Array.isArray(b) ? { x: b[0], y: b[1], w: b[2], h: b[3] } : b)

/** frame px 박스 → { frame:[x,y,w,h] (frame px), x,y,w,h (dp, D1) } */
function boxes(fb0) {
  const fb = asBox(fb0)
  if (!fb || ![fb.x, fb.y, fb.w, fb.h].every((v) => typeof v === 'number')) throw new Error(`[gen] frameBox 가 {x,y,w,h} 숫자가 아님: ${q(fb0)}`)
  const frame = [U.round3(fb.x), U.round3(fb.y), U.round3(fb.w), U.round3(fb.h)]
  return { frame, ...U.boxDp(fb) }
}
/** frame px 박스 → 바깥으로 둥근 마스크 "x,y,w,h" */
function maskOf(fb0) {
  const b = asBox(fb0)
  const x0 = Math.floor(b.x)
  const y0 = Math.floor(b.y)
  return `${x0},${y0},${Math.ceil(b.x + b.w) - x0},${Math.ceil(b.y + b.h) - y0}`
}

const characterMasks = new Map() // shot name → [mask]
for (const { base, file } of assetFiles) {
  const list = readJson(file)
  if (!Array.isArray(list)) throw new Error(`[gen] spec/${base}.assets.json: 배열이어야 한다`)
  const specGroup = groupOfBase.get(base) || base
  for (const a of list) {
    const relFile = String(a.file || '').replace(/^\/+/, '') // 'woori/home/x.png'
    const m = /^woori\/([^/]+)\//.exec(relFile)
    if (!m) throw new Error(`[gen] ${base}: 에셋 경로는 'woori/<그룹>/…' 여야 한다: ${a.file}`)
    if (!a.name) throw new Error(`[gen] ${base}: name 없는 에셋 ${a.file}`)
    const group = m[1]
    const key = String(a.name).startsWith(`${group}.`) ? String(a.name) : `${group}.${a.name}`
    if (seen.has(key)) throw new Error(`[gen] 이름 충돌: ${key} (${seen.get(key)} / ${base})`)
    seen.set(key, base)

    const abs = path.join(PUBLIC, relFile)
    const exists = fs.existsSync(abs)
    if (!exists) missing.push({ key, file: relFile, spec: base })
    const kind = relFile.endsWith('.svg') ? 'svg' : relFile.endsWith('.png') ? 'png' : 'other'
    let intrinsic = null
    let transparent = kind === 'svg'
    if (exists && kind === 'png') {
      const info = pngInfo(abs)
      intrinsic = [info.w, info.h]
      transparent = info.alpha
    }
    const uses = []
    for (const u of a.usedIn ?? []) uses.push({ state: String(u.state ?? ''), element: u.element ?? '', ...boxes(u.frameBox) })
    const e = {
      key,
      spec: base,
      group,
      file: relFile,
      kind,
      scale: a.scale ?? (kind === 'png' ? 3 : 1),
      transparent,
      intrinsic,
      color: a.color ?? null,
      character: a.character === true,
      // referenceOnly: 영상 대조용으로만 남긴 에셋 (화면은 이 파일을 쓰지 않는다). 이유를 note 앞에 붙인다
      referenceOnly: a.referenceOnly ?? null,
      note: a.referenceOnly
        ? `참고용(앱 안 씀): ${a.referenceOnly}`.slice(0, 120)
        : (a.character ? '캐릭터 대체 그림(독창, 비교 마스크). ' : '') + String(a.notes ?? '').split(/[.。]\s|\n/)[0].slice(0, 120),
      box: boxes(a.frameBox),
      state: String(a.state ?? ''),
      uses,
      // hq: 실제 기기(프레임 모드가 아닐 때)에서 쓰는 선명한 판 — 다시 키운 PNG 또는 벡터 SVG. 프레임 모드(영상 대조)는 file 을 그대로 쓴다
      hq: a.hq ? String(a.hq).replace(/^\/+/, '') : null,
    }
    if (e.hq && !fs.existsSync(path.join(PUBLIC, e.hq))) missing.push({ key: key + ' (hq)', file: e.hq, spec: base })
    e.note = e.note.trim()
    entries.push(e)
    if (e.character) {
      const add = (state, fb) => {
        if (!state) return
        const name = `${specGroup}/${state}`
        if (!characterMasks.has(name)) characterMasks.set(name, [])
        characterMasks.get(name).push(maskOf(fb))
      }
      add(e.state, a.frameBox)
      for (const u of a.usedIn ?? []) add(String(u.state ?? ''), u.frameBox)
    }
  }
}

// public/woori/ 아래에 있지만 어떤 spec 에도 없는 파일
const referenced = new Set(entries.flatMap((e) => (e.hq ? [e.file, e.hq] : [e.file])))
const unreferenced = []
const walkPublic = (dir) => {
  if (!fs.existsSync(dir)) return
  for (const name of fs.readdirSync(dir)) {
    const abs = path.join(dir, name)
    if (fs.statSync(abs).isDirectory()) walkPublic(abs)
    else {
      const r = path.relative(PUBLIC, abs).split(path.sep).join('/')
      if (!referenced.has(r)) unreferenced.push(r)
    }
  }
}
walkPublic(path.join(PUBLIC, 'woori'))

// 스케일 검사: PNG 실제 크기 = 프레임 박스(frame px) x scale (±1px)
const scaleMismatch = entries.filter((e) => {
  if (!e.intrinsic) return false
  const [, , fw, fh] = e.box.frame
  return Math.abs(e.intrinsic[0] - fw * e.scale) > 1.01 || Math.abs(e.intrinsic[1] - fh * e.scale) > 1.01
})

// 화면 코드에서 이름을 따옴표째 쓰는지 (WooriArt/WooriArtbox 자신은 뺀다). 은행 로고(banks.*)는 bankArtName() 으로 만들어 쓰므로 뺀다.
const srcText = HAS_SRC
  ? (function walk(d) {
      return fs.readdirSync(d, { withFileTypes: true }).flatMap((x) => {
        const p = path.join(d, x.name)
        if (x.isDirectory()) return walk(p)
        return /\.(tsx?|css)$/.test(x.name) && x.name !== 'WooriArt.ts' && x.name !== 'WooriArtbox.ts' ? [fs.readFileSync(p, 'utf8')] : []
      })
    })(SRC).join('\n')
  : ''
const usedInSrc = (key) => ["'", '"', '`'].some((qc) => srcText.includes(qc + key + qc))
const refButUsed = entries.filter((e) => e.referenceOnly && usedInSrc(e.key))
const unusedUnmarked = HAS_SRC ? entries.filter((e) => !e.referenceOnly && e.group !== 'banks' && !usedInSrc(e.key)) : []

console.log(`[gen] 에셋 ${entries.length}개 (spec ${assetFiles.map((a) => `${a.base}.assets.json`).join(', ') || '없음'})`)
console.log(`[gen] 누락 파일 ${missing.length}개${missing.length ? ':' : ''}`)
for (const m of missing) console.log(`        - ${m.key}  ${m.file}  (${m.spec}.assets.json)`)
console.log(`[gen] spec 에 없는 public 파일 ${unreferenced.length}개${unreferenced.length ? ':' : ''}`)
for (const u of unreferenced) console.log(`        - ${u}`)
console.log(`[gen] PNG 크기 ≠ 박스 x scale: ${scaleMismatch.length}개`)
for (const e of scaleMismatch) console.log(`        - ${e.key} ${e.intrinsic.join('x')} vs frame box ${e.box.frame[2]}x${e.box.frame[3]} x${e.scale}`)
const refCount = entries.filter((e) => e.referenceOnly).length
console.log(`[gen] 참고용(referenceOnly) ${refCount}개, 그중 화면 코드가 쓰는 것 ${refButUsed.length}개${refButUsed.length ? ':' : ''}`)
for (const e of refButUsed) console.log(`        - ${e.key} — 쓰면 spec 의 referenceOnly 를 지운다`)
if (unusedUnmarked.length) {
  console.log(`[gen] 경고: 화면 코드에 이름이 안 보이는 에셋 ${unusedUnmarked.length}개 (안 쓰면 *.assets.json 에 "referenceOnly": "<이유>"):`)
  for (const e of unusedUnmarked) console.log(`        - ${e.key}`)
}

/* ───────────────────────── 2. WooriArt.ts / WooriArtbox.ts ───────────────────────── */

const GROUP_ORDER = ['launch', 'home', 'history', 'history-detail', 'send-a', 'send-b', 'done', 'banks', 'common']
const gIdx = (g) => (GROUP_ORDER.includes(g) ? GROUP_ORDER.indexOf(g) : GROUP_ORDER.length)
entries.sort((a, b) => gIdx(a.group) - gIdx(b.group) || (gIdx(a.group) === GROUP_ORDER.length ? a.group.localeCompare(b.group) : 0))
const groups = [...GROUP_ORDER, ...[...new Set(entries.map((e) => e.group))].filter((g) => !GROUP_ORDER.includes(g)).sort()]
const groupType = groups.map(q).join(' | ')

const header = `// ⚠️ 자동 생성 파일 — 직접 고치지 말고 spec/*.assets.json 을 고친 뒤 \`node tools/gen-from-spec.cjs\` 를 다시 실행한다.`

function genArt() {
  const names = entries.length ? entries.map((e) => `  | ${q(e.key)}`).join('\n') : '  never'
  const rows = entries
    .map((e) => {
      const parts = [`file: ${q(e.file)}`, `kind: ${q(e.kind)}`, `scale: ${e.scale}`, `transparent: ${e.transparent}`]
      if (e.intrinsic) parts.push(`intrinsic: [${e.intrinsic.join(', ')}]`)
      if (e.hq) parts.push(`hq: ${q(e.hq)}`)
      if (e.color) parts.push(`color: ${q(e.color)}`)
      if (e.character) parts.push('character: true')
      if (e.referenceOnly) parts.push('referenceOnly: true')
      if (e.note) parts.push(`note: ${q(e.note)}`)
      return `  ${q(e.key)}: { ${parts.join(', ')} },`
    })
    .join('\n')
  return `${header}
//
// WooriArt — 잘라낸 아트 에셋 파일 표 (이름 → public/ 경로)
//
// 이름 = '<그룹>.<spec 의 name>' (그룹 = public/woori/<그룹>/).
// PNG 는 정지 구간 원본 프레임(손잡이 지운 clean 영상) 중앙값 → 크롭 → 업스케일 이미지다.
// 파일 크기 = 영상 frame px 박스 × scale. 화면에는 WooriArtbox.ts 의 w/h (dp, D1) 로 표시한다.
// character: true 는 캐릭터 자리의 독창적 대체 그림 (영상의 캐릭터를 따라 그리지 않음, 비교에서는 마스크).
// 원본 표: ${assetFiles.map((a) => `spec/${a.base}.assets.json`).join(', ') || '(아직 없음)'}

export type WooriArtGroup = ${groupType}

export type WooriArtName =
${names}

export interface WooriArtFile {
  /** public/ 기준 경로 (앞에 '/' 없이), 예: 'woori/home/banner-1.png' */
  file: string
  kind: 'png' | 'svg' | 'other'
  /** 파일 해상도 ÷ 영상 frame px 박스 (업스케일 PNG → 3, SVG → 1). 표시 크기(dp)는 WooriArtbox 의 w/h */
  scale: number
  /** 투명 배경 여부 (PNG 알파 채널 / SVG) */
  transparent: boolean
  /** PNG 실제 픽셀 크기 [w, h] (= frame px 박스 × scale) */
  intrinsic?: readonly [number, number]
  /** 실제 기기용 선명한 판 (public/ 기준 경로). 프레임 모드가 아닐 때 artSrc 가 이 파일을 준다 — 다시 키운 PNG(Real-ESRGAN, 역투영) 또는 벡터 SVG */
  hq?: string
  /** SVG 기본 색 (파일에 박힌 색) */
  color?: string
  /** 캐릭터 자리의 독창적 대체 그림 (비교 마스크) */
  character?: true
  /** 영상 대조용 참고 에셋: 화면은 이 파일을 쓰지 않는다 (이유는 note, spec 의 referenceOnly) */
  referenceOnly?: true
  /** 설명 (spec notes 첫 문장, 참고용이면 그 이유) */
  note?: string
}

export const WOORI_ART: Record<WooriArtName, WooriArtFile> = {
${rows}
}

export const WOORI_ART_NAMES = Object.keys(WOORI_ART) as WooriArtName[]

/** 이름 → 파일 (표가 비어 WooriArtName 이 never 여도 타입이 무너지지 않게 넓힌 보기) */
const ART: Readonly<Record<string, WooriArtFile>> = WOORI_ART

export function hasArt(name: string): name is WooriArtName {
  return Object.prototype.hasOwnProperty.call(WOORI_ART, name)
}

export function getArt(name: WooriArtName): WooriArtFile {
  return ART[name] as WooriArtFile
}

/**
 * 에셋 URL ('/woori/...').
 * 프레임 모드(?frame=1 — 영상과 겹쳐 보는 비교)에서는 영상에서 만든 원래 파일(file)을 그대로 쓰고,
 * 그 밖(실제 폰·태블릿·APK)에서는 선명한 판(hq)이 있으면 그것을 쓴다. 영상 해상도(1dp ≈ 1.46px)보다 촘촘한 화면에서 흐리지 않게.
 */
export function artSrc(name: WooriArtName): string {
  const a = getArt(name)
  const frame = typeof document !== 'undefined' && document.documentElement.dataset.frame === '1'
  return '/' + (a.hq && !frame ? a.hq : a.file)
}

/** 은행 로고 에셋 이름 ('banks.<코드>', 없으면 undefined) */
export function bankArtName(code: string): WooriArtName | undefined {
  const name = \`banks.\${code}\`
  return hasArt(name) ? name : undefined
}
`
}

const rectTs = (r) => `x: ${r.x}, y: ${r.y}, w: ${r.w}, h: ${r.h}, frame: [${r.frame.join(', ')}]`
const SB_DP = U.round3(U.STATUS_BAR_DP)
const SB_PX = U.round3(U.STATUS_BAR_PX)

function genArtbox() {
  const rows = entries
    .map((e) => {
      const parts = [rectTs(e.box), `screen: ${q(e.group === 'banks' ? 'send-a' : e.group)}`, `state: ${q(e.state)}`]
      if (e.character) parts.push('character: true')
      if (e.uses.length) {
        const uses = e.uses.map((u) => `{ state: ${q(u.state)}, element: ${q(u.element)}, ${rectTs(u)} }`).join(',\n      ')
        parts.push(`uses: [\n      ${uses},\n    ]`)
      }
      return `  ${q(e.key)}: { ${parts.join(', ')} },`
    })
    .join('\n')
  return `${header}
//
// WooriArtbox — 아트 에셋이 영상 화면에서 있던 자리(박스) 표
//
// 단위 dp (D1, tools/woori-units.cjs): 가로 x = 180 + (x_px − 262.02)/1.45803, 폭 w = w_px/1.45803,
//   세로 y = y_px × 0.6875, 높이 h = h_px × 0.6875 (폰 뷰포트 360x880). 원본 frame px 박스는 frame: [x, y, w, h] 에 그대로 있다 (도구용).
// x/y 는 화면 맨 위(상태바 ${SB_DP}dp 포함) 기준이다. 앱 내용은 y ${SB_DP}dp(frame ${SB_PX}px)부터 시작하므로
// artBox() / artBoxIn() 이 기본으로 y 에서 ${SB_DP} 를 빼서 앱 내용 기준 left/top 을 준다.
// 레이아웃 위치(top/left)는 그릴 때 정수 dp 로 반올림되므로 소수 dp 는 spec 의 설계 dp 로 맞춘다 (spec/*.md).
// state 가 박스를 잰 spec 상태다.
import type { CSSProperties } from 'react'
import type { WooriArtName } from './WooriArt.ts'

/** 박스 (dp). frame = 같은 박스의 영상 frame px [x, y, w, h] */
export interface WooriArtRect {
  /** dp, 화면 왼쪽 기준 */
  x: number
  /** dp, 화면 맨 위(상태바 포함) 기준 */
  y: number
  w: number
  h: number
  frame: readonly [number, number, number, number]
}

export interface WooriArtUse extends WooriArtRect {
  /** spec 상태 id */
  state: string
  /** spec 요소 이름 */
  element: string
}

export interface WooriArtBox extends WooriArtRect {
  /** 어느 화면 그룹 기준 좌표인지 */
  screen: ${groupType}
  /** 박스를 잰 spec 상태 (spec 원문) */
  state: string
  /** 캐릭터 대체 그림 자리 (비교 마스크) */
  character?: true
  /** 같은 에셋의 다른 상태/요소 위치 */
  uses?: readonly WooriArtUse[]
}

export const WOORI_ARTBOX: Record<WooriArtName, WooriArtBox> = {
${rows}
}

/** 앱 내용 시작점 (dp). 상태바 ${SB_DP}dp 아래 */
export const CONTENT_ORIGIN = { x: 0, y: ${SB_DP} } as const
/** 같은 점의 영상 frame px (상태바 ${SB_PX}px). 도구용 */
export const FRAME_CONTENT_ORIGIN = { x: 0, y: ${SB_PX} } as const

export interface ArtBoxOptions {
  /** 좌표 원점 (dp, 화면 맨 위 기준). 기본 CONTENT_ORIGIN {x:0, y:${SB_DP}}. 시트/카드 안에 놓을 땐 그 요소의 좌상단을 넘긴다. */
  origin?: { x: number; y: number }
  /** position 속성 (기본 'absolute') */
  position?: CSSProperties['position']
}

/** 이름 → 박스 (표가 비어 WooriArtName 이 never 여도 타입이 무너지지 않게 넓힌 보기) */
const BOX: Readonly<Record<string, WooriArtBox>> = WOORI_ARTBOX

export function getArtBox(name: WooriArtName): WooriArtBox {
  return BOX[name] as WooriArtBox
}

/** 상태(+요소)에 맞는 박스 (dp, 화면 맨 위 기준). uses 에 없으면 기본 박스. */
export function getArtRect(name: WooriArtName, state?: string, element?: string): WooriArtRect {
  const box = getArtBox(name)
  if (state && box.uses) {
    const hit = box.uses.find((u) => u.state === state && (element === undefined || u.element === element))
    if (hit) return hit
  }
  return box
}

/** 같은 박스를 영상 frame px 로 ({x,y,w,h}, 상태바 포함 좌표). 비교 도구용 */
export function getArtFrameRect(name: WooriArtName, state?: string, element?: string): { x: number; y: number; w: number; h: number } {
  const [x, y, w, h] = getArtRect(name, state, element).frame
  return { x, y, w, h }
}

const round3 = (v: number) => Math.round(v * 1000) / 1000

function rectStyle(r: WooriArtRect, opts: ArtBoxOptions): CSSProperties {
  const o = opts.origin ?? CONTENT_ORIGIN
  return {
    position: opts.position ?? 'absolute',
    left: round3(r.x - o.x),
    top: round3(r.y - o.y),
    width: r.w,
    height: r.h,
  }
}

/** 박스 → { position, left, top, width, height } (dp = CSS px). 기본은 앱 내용 기준 */
export function artBox(name: WooriArtName, opts: ArtBoxOptions = {}): CSSProperties {
  return rectStyle(getArtBox(name), opts)
}

/** 상태/요소별 박스 → style */
export function artBoxIn(name: WooriArtName, state: string, element?: string, opts: ArtBoxOptions = {}): CSSProperties {
  return rectStyle(getArtRect(name, state, element), opts)
}

/** 크기만 ({ width, height }, dp) */
export function artSize(name: WooriArtName): CSSProperties {
  const box = getArtBox(name)
  return { width: box.w, height: box.h }
}
`
}

/* ───────────────────────── 3. shots.json ───────────────────────── */

/** 그룹 → 기본 라우트 (inventory routes). 상태마다 다르면 spec 상태에 "route" 를 쓴다 */
const DEFAULT_ROUTES = {
  launch: '/',
  home: '/home',
  history: '/history',
  'history-detail': '/history',
  'send-a': '/send',
  'send-b': '/send/amount',
  done: '/send/done',
}

// 손으로 넣은 필드: 재생성해도 유지 (url 은 keepUrl, note 는 keepNote, scenario 는 keepScenario 일 때만)
const MANUAL_FIELDS = ['steps', 'freezeAfterSteps', 'waitMs', 'keepAnim', 't', 'noDefaultMask', 'boxesSelector', 'refMask', 'keepUrl', 'keepScenario']

/** tools/ref/video/<v>-pts.json (woori_video.py 캐시, git 제외) — 있으면 t0/t1 을 채우고 맞는지 본다 */
const ptsCache = new Map()
function ptsOf(video) {
  if (!ptsCache.has(video)) {
    const f = path.join(TOOLS_DIR, 'ref', 'video', `${video}-pts.json`)
    let p = null
    try {
      p = fs.existsSync(f) ? readJson(f) : null
    } catch {
      p = null
    }
    ptsCache.set(video, Array.isArray(p) ? p : null)
  }
  return ptsCache.get(video)
}

const warnings = []
const problems = []
let refMissing = 0

function genShots(old) {
  const oldByName = new Map((old.shots ?? []).map((s) => [s.name, s]))
  const out = []
  const rows = [] // spec/timeline.md 표
  for (const { base, d } of screens) {
    const group = d.group || base
    for (const s of d.states) {
      if (!s || !s.id || !s.refFrame) continue
      const id = String(s.id)
      const name = `${group}/${id}`
      // 다른 상태 ref 를 재사용하는 상태는 레지스트리에 넣지 않는다
      if (path.basename(String(s.refFrame), '.png') !== id) continue
      const video = s.video ?? d.video
      if (!video || s.i0 == null || s.i1 == null) {
        warnings.push(`${name}: video·i0·i1 이 없어 shots 에 넣지 않음`)
        continue
      }
      const i0 = Number(s.i0)
      const i1 = Number(s.i1)
      if (!Number.isInteger(i0) || !Number.isInteger(i1) || i1 < i0) {
        problems.push(`${name}: i0/i1 이 정수 구간이 아님 (${q(s.i0)}–${q(s.i1)})`)
        continue
      }
      const pts = ptsOf(video)
      let t0 = typeof s.t0 === 'number' ? s.t0 : pts?.[i0]
      let t1 = typeof s.t1 === 'number' ? s.t1 : pts?.[i1]
      if (pts) {
        if (pts[i1] == null) problems.push(`${name}: i1 #${i1} 이 ${video} 프레임 수(${pts.length}) 밖`)
        else if (Math.abs((t0 ?? pts[i0]) - pts[i0]) > 0.0015 || Math.abs((t1 ?? pts[i1]) - pts[i1]) > 0.0015) {
          warnings.push(`${name}: spec t0/t1 (${t0}–${t1}) 이 #${i0}/#${i1} 의 pts (${pts[i0]}–${pts[i1]}) 와 다름 — 기준은 i0/i1`)
        }
      }
      const prev = oldByName.get(name) ?? {}
      const masks = new Set()
      for (const m of [...(s.mask ?? []), ...(s.compareMask ?? []), ...(characterMasks.get(name) ?? [])]) {
        try {
          masks.add(U.resolveMask(m))
        } catch (e) {
          problems.push(`${name}: ${e.message}`)
        }
      }
      let scenario
      try {
        scenario = checkScenario(prev.keepScenario && prev.scenario ? prev.scenario : s.scenario ?? d.scenario ?? scenarioFor(video, t0), `${name}: `)
      } catch (e) {
        problems.push(e.message)
        continue
      }
      const route = String(s.route ?? d.route ?? DEFAULT_ROUTES[group] ?? `/${group}`)
      const url = prev.keepUrl && prev.url ? prev.url : s.url ?? `${route}${route.includes('?') ? '&' : '?'}frame=1&shot=${encodeURIComponent(id)}`
      const summary = String(s.summary ?? s.description ?? s.desc ?? '').replace(/\s+/g, ' ').slice(0, 140)
      const entry = { name, url, video, i0, i1 }
      if (typeof t0 === 'number') entry.t0 = roundT(t0)
      if (typeof t1 === 'number') entry.t1 = roundT(t1)
      entry.mask = [...masks]
      entry.scenario = scenario
      if (typeof s.scrollTop === 'number' && s.scrollTop > 0) entry.scrollTop = s.scrollTop
      for (const k of MANUAL_FIELDS) if (prev[k] !== undefined) entry[k] = prev[k]
      entry.spec = `spec/${base}.md`
      entry.note = prev.note && prev.keepNote ? prev.note : summary
      if (prev.keepNote) entry.keepNote = true
      out.push(entry)
      rows.push(entry)
      const refPng = path.join(ROOT, String(s.refFrame))
      if (!fs.existsSync(refPng)) refMissing++
      // 기준 프레임이 이 컴퓨터에 있으면 spec 구간으로 만든 것인지 (tools/ref/<name>.json, git 제외)
      const sidecar = refPng.replace(/\.png$/, '.json')
      if (fs.existsSync(sidecar)) {
        try {
          const sc = readJson(sidecar)
          if (sc.video !== video || sc.i0 !== i0 || sc.i1 !== i1) {
            warnings.push(`${name}: 기준 프레임(${sc.video} #${sc.i0}–#${sc.i1})이 spec 구간(${video} #${i0}–#${i1})과 다름 → python3 tools/ref.py --all --force --only '${name}$'`)
          }
        } catch {
          /* 무시 */
        }
      }
    }
  }
  const names = new Set(out.map((s) => s.name))
  for (const [n, ms] of characterMasks) if (!names.has(n)) warnings.push(`캐릭터 마스크 ${ms.join(' ')} 의 상태 ${n} 가 shots 에 없음 (에셋 state/usedIn 이름 확인)`)
  const comment =
    '공유 상태 레지스트리 — 손으로 고치지 말 것 (tools/gen-from-spec.cjs --shots 가 spec/*.json 의 states 에서 생성; 화면별 덧붙임/덮어쓰기는 tools/shots.d/<group>.json). ' +
    'name=<group>/<spec 상태 id> = tools/ref/<name>.png, url 의 shot= 값 = 화면 컴포넌트의 ?shot= 상태 id, 앞에 http://localhost:$WOORI_WEB_PORT 가 붙는다. ' +
    'video·i0·i1 = 기준 프레임을 만든 영상과 원본 프레임 구간(둘 다 포함, tools/ref.py --all), t0/t1 = 그 pts(초). ' +
    'mask=[x,y,w,h] 는 비교 제외(frame px; 상태바·내비 바는 기본 마스크라 여기엔 없음, 캐릭터 대체 그림 박스는 자동). ' +
    'scenario = shot 전에 POST /api/dev/reset 할 백엔드 시나리오 (v1-start | v2-start | v2-end). t = 애니메이션 위상(ms). ' +
    '손으로 넣은 steps/waitMs/keepAnim/t/noDefaultMask 는 재생성해도 유지된다 (url 은 keepUrl:true, note 는 keepNote:true, scenario 는 keepScenario:true 일 때만).'
  const lines = out.map((s) => '    ' + JSON.stringify(s)) // 한 줄 = 한 상태 (사람이 읽기 쉽게)
  const text = `{\n  "_comment": ${q(comment)},\n  "shots": [\n${lines.join(',\n')}${lines.length ? '\n' : ''}  ]\n}\n`
  return { text, out, rows }
}

/*
 * spec/timeline.md: 기준 구간 표를 shots.json 과 같은 값으로. 표시 줄 사이만 바꾼다.
 * shots.d(화면 담당)의 위상 shot 은 넣지 않는다 — 그쪽이 바뀔 때마다 이 검사가 깨지지 않게.
 */
const TL_BEGIN = '<!-- gen-from-spec:shots-table'
const TL_END = '<!-- /gen-from-spec:shots-table -->'

function genTimelineTable(rows) {
  const lines = [
    `${TL_BEGIN} — 손으로 고치지 말 것: node tools/gen-from-spec.cjs --shots 가 tools/shots.json 과 같은 값으로 다시 쓴다 -->`,
    '| 상태 (shots.json name = tools/ref/<name>.png) | 영상 | 기준 프레임 (포함) | 시각 t0–t1 (s) | scenario |',
    '|---|---|---|---|---|',
    ...rows.map((r) => `| \`${r.name}\` | ${r.video} | #${r.i0}–#${r.i1} | ${r.t0 ?? ''}–${r.t1 ?? ''} | ${r.scenario} |`),
    TL_END,
  ]
  return lines.join('\n')
}

function applyTimelineTable(md, table) {
  const a = md.indexOf(TL_BEGIN)
  const b = md.indexOf(TL_END)
  if (a < 0 || b < a) return null
  return md.slice(0, a) + table + md.slice(b + TL_END.length)
}

/* ───────────────────────── 4. 쓰기 / 검사 ───────────────────────── */

const artTs = genArt()
const artboxTs = genArtbox()
const oldShots = fs.existsSync(SHOTS) ? readJson(SHOTS) : { shots: [] }
const shots = genShots(oldShots)
const timelineExists = fs.existsSync(TIMELINE)
const timelineOld = timelineExists ? fs.readFileSync(TIMELINE, 'utf8') : ''
const timelineNew = timelineExists ? applyTimelineTable(timelineOld, genTimelineTable(shots.rows)) : null
let failed = missing.length > 0 || problems.length > 0

for (const w of warnings) console.log(`[gen] 경고: ${w}`)
for (const p of problems) console.log(`[gen] 문제: ${p}`)

const boxesOk = entries.every((e) => [e.box, ...e.uses].every((b) => {
  const [fx, fy, fw, fh] = b.frame
  return Math.abs(U.exact.xPx(b.x) - fx) <= 0.002 && Math.abs(U.exact.yPx(b.y) - fy) <= 0.002 &&
    Math.abs(U.exact.wPx(b.w) - fw) <= 0.002 && Math.abs(U.exact.hPx(b.h) - fh) <= 0.002
}))

if (CHECK_ONLY) {
  const same = (file, text) => fs.existsSync(file) && fs.readFileSync(file, 'utf8') === text
  const SKIP = 'skip'
  const checks = [
    ['에셋 누락 0', missing.length === 0],
    ['spec 에 없는 public/woori 파일 0', unreferenced.length === 0],
    ['PNG 크기 = frame 박스 x scale', scaleMismatch.length === 0],
    ['참고용(referenceOnly) 에셋을 화면 코드가 안 씀', HAS_SRC ? refButUsed.length === 0 : SKIP],
    ['frontend/src/WooriArt.ts 최신', HAS_SRC ? same(path.join(SRC, 'WooriArt.ts'), artTs) : SKIP],
    ['frontend/src/WooriArtbox.ts 최신', HAS_SRC ? same(path.join(SRC, 'WooriArtbox.ts'), artboxTs) : SKIP],
    ['tools/shots.json 최신', same(SHOTS, shots.text)],
    ['spec/timeline.md 기준 구간 표 = shots.json', timelineNew === null ? SKIP : timelineNew === timelineOld],
    ['박스 dp = D1(frame px)', boxesOk],
    ['상태 이름 중복 없음', new Set(shots.out.map((s) => s.name)).size === shots.out.length],
    ['spec 상태 문제 없음 (구간·마스크·scenario)', problems.length === 0],
  ]
  for (const [label, ok] of checks) {
    if (ok === SKIP) {
      const why = label.includes('timeline') ? (timelineExists ? '표시 줄 없음' : 'spec/timeline.md 없음') : 'frontend/src 없음'
      console.log(`SKIP  ${label} (${why})`)
      continue
    }
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${label}`)
    if (!ok) failed = true
  }
  if (failed) console.log('→ node tools/gen-from-spec.cjs --shots 로 다시 생성 (에셋 문제는 spec/*.assets.json / frontend/public/woori 확인)')
  else console.log(`gen-from-spec --check OK (에셋 ${entries.length}개, 상태 ${shots.out.length}개)`)
} else {
  if (!boxesOk) failed = true
  if (HAS_SRC) {
    fs.writeFileSync(path.join(SRC, 'WooriArt.ts'), artTs)
    fs.writeFileSync(path.join(SRC, 'WooriArtbox.ts'), artboxTs)
    console.log('[gen] frontend/src/WooriArt.ts, WooriArtbox.ts 생성 (dp, D1)')
  } else {
    console.log('[gen] frontend/src 없음 — WooriArt.ts · WooriArtbox.ts 는 건너뜀 (프론트를 만든 뒤 다시 실행)')
  }
  if (WITH_SHOTS) {
    fs.mkdirSync(path.dirname(SHOTS), { recursive: true })
    fs.writeFileSync(SHOTS, shots.text)
    if (!timelineExists) console.log('[gen] spec/timeline.md 없음 — 기준 구간 표는 건너뜀')
    else if (timelineNew === null) console.log(`[gen] spec/timeline.md 에 표시 줄(${TL_BEGIN} … ${TL_END}) 이 없어 기준 구간 표는 건너뜀`)
    else if (timelineNew !== timelineOld) {
      fs.writeFileSync(TIMELINE, timelineNew)
      console.log('[gen] spec/timeline.md 기준 구간 표 갱신')
    }
    const byScn = {}
    for (const s of shots.out) byScn[s.scenario] = (byScn[s.scenario] || 0) + 1
    console.log(`[gen] ${rel(SHOTS)}: 상태 ${shots.out.length}개 (이 컴퓨터에 기준 프레임 없음 ${refMissing}개, scenario ${Object.entries(byScn).map(([k, v]) => `${k} ${v}`).join(' · ') || '-'})`)
  }
}
process.exit(failed ? 1 : 0)
