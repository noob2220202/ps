// node:fs — 서버 코드가 부르는 것만. 파일 시스템은 없다 (DB 는 node-sqlite 가 IndexedDB 에): 폴더 만들기·지우기는 아무것도 안 하고, 파일은 늘 '없음'.
export const mkdirSync = () => undefined;
export const renameSync = () => undefined;
export const rmSync = () => undefined;
export const writeFileSync = () => undefined;
export const existsSync = () => false;
export const readFileSync = () => {
  throw new Error("readFileSync: 파일 시스템이 없다");
};
