'use strict';
// 로컬 모드 전용: backend/app.js 의 app.use(cors()) 자리. 같은 출처(앱 안)라 CORS 머리글이 필요 없다 → 그냥 다음으로.
// vite.config.ts 가 로컬 빌드에서만 'cors' 를 이 파일로 바꾼다.
module.exports = function cors() {
  return function wooriCors(req, res, next) {
    next();
  };
};
