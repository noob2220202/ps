// 프로그램판(.exe) 메인 프로세스. server/index.mjs(Express + node:sqlite)를 이 프로세스 안에서 그대로 띄우고,
// 그 주소를 창에 띄운다. "녹화 맨 앞에 인트로 영상 붙이기"가 켜져 있을 때만 화면 쪽에서 IPC로 녹화 영상을 보내오고,
// 여기서 ffmpeg로 인트로 영상 + 녹화 영상을 이어붙여 사용자가 고른 자리에 저장한다.
const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("node:path");
const fs = require("node:fs");
const os = require("node:os");
const http = require("node:http");
const { spawn } = require("node:child_process");
const ffmpegPath = require("ffmpeg-static");
const ffprobePath = require("ffprobe-static").path;

const ROOT = path.join(__dirname, "..");
const INTRO_VIDEO = path.join(__dirname, "assets", "intro-default.mp4");
const DEFAULT_PORTS = { kakao: 9101, nh: 9103, hana: 9105, ibk: 9107 };

process.env.APP = process.env.APP || "ibk";

let win;

function waitForServer(port, triesLeft = 50) {
  return new Promise((resolve, reject) => {
    const tick = (n) => {
      const req = http.get({ host: "127.0.0.1", port, path: "/", timeout: 1000 }, (res) => {
        res.resume();
        resolve();
      });
      req.on("error", () => (n <= 0 ? reject(new Error("서버가 시작되지 않았어요")) : setTimeout(() => tick(n - 1), 150)));
      req.on("timeout", () => {
        req.destroy();
        if (n <= 0) reject(new Error("서버 응답 없음"));
        else setTimeout(() => tick(n - 1), 150);
      });
    };
    tick(triesLeft);
  });
}

async function startServer() {
  const port = Number(process.env.PORT || DEFAULT_PORTS[process.env.APP] || 9107);
  process.env.PORT = String(port);
  await import(`file://${path.join(ROOT, "server", "index.mjs")}`);
  await waitForServer(port);
  return port;
}

async function createWindow() {
  const port = await startServer();
  win = new BrowserWindow({
    width: 480,
    height: 920,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  win.loadURL(`http://127.0.0.1:${port}`);
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());

// ---------- 녹화 저장: 인트로 영상 + 녹화 영상을 ffmpeg로 이어붙여서 저장 ----------
function defaultFileName() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `bank-clone_${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}.mp4`;
}

// 녹화 영상의 실제 가로세로(기기·줌에 따라 달라짐)를 ffprobe로 읽어서, 인트로 영상을 그 크기로 맞춘다
// (scale2ref 필터로 자동 맞추는 방법은 ffmpeg-static 빌드에서 두 영상이 잘리는 버그가 있어 쓰지 않음)
function getVideoSize(filePath) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffprobePath, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height", "-of", "csv=p=0", filePath]);
    let out = "";
    let err = "";
    proc.stdout.on("data", (d) => (out += d));
    proc.stderr.on("data", (d) => (err += d));
    proc.on("error", reject);
    proc.on("close", (code) => {
      const [width, height] = out.trim().split(",").map(Number);
      if (code !== 0 || !width || !height) return reject(new Error(`ffprobe 실패: ${err.slice(-500)}`));
      resolve({ width, height });
    });
  });
}

function runFfmpegConcat(introPath, recordedPath, outPath) {
  return new Promise((resolve, reject) => {
    getVideoSize(recordedPath)
      .then(({ width, height }) => {
        const args = [
          "-y",
          "-i", introPath,
          "-i", recordedPath,
          "-filter_complex",
          `[0:v]scale=${width}:${height},fps=30,setsar=1[v0f];[1:v]fps=30,setsar=1[v1f];[v0f][v1f]concat=n=2:v=1:a=0[outv]`,
          "-map", "[outv]",
          "-c:v", "libx264",
          "-preset", "veryfast",
          "-crf", "20",
          "-pix_fmt", "yuv420p",
          "-movflags", "+faststart",
          "-an",
          outPath,
        ];
        const proc = spawn(ffmpegPath, args);
        let stderr = "";
        proc.stderr.on("data", (d) => (stderr += d));
        proc.on("error", reject);
        proc.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`ffmpeg 종료코드 ${code}: ${stderr.slice(-800)}`))));
      })
      .catch(reject);
  });
}

ipcMain.handle("recording:save", async (_event, { buffer, ext }) => {
  const stamp = Date.now();
  const input = path.join(os.tmpdir(), `bank-clone-rec-${stamp}.${ext}`);
  const output = path.join(os.tmpdir(), `bank-clone-out-${stamp}.mp4`);
  try {
    fs.writeFileSync(input, Buffer.from(buffer));
    await runFfmpegConcat(INTRO_VIDEO, input, output);
    const { canceled, filePath } = await dialog.showSaveDialog(win, {
      title: "녹화 저장",
      defaultPath: path.join(app.getPath("videos"), defaultFileName()),
      filters: [{ name: "MP4 영상", extensions: ["mp4"] }],
    });
    if (canceled || !filePath) return { ok: false, canceled: true };
    fs.copyFileSync(output, filePath);
    return { ok: true, path: filePath };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    for (const f of [input, output]) {
      try {
        fs.unlinkSync(f);
      } catch {
        // 임시 파일 정리는 실패해도 무시
      }
    }
  }
});
