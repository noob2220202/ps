package dev.answerkey.won;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/**
 * WON 답지 (연습용, 배포하지 않음). 웹 앱(frontend/dist-apk)을 Capacitor 웹뷰로 띄운다 — 서버 없이 폰 안에서만 돈다
 * (데이터는 웹뷰 IndexedDB 의 SQLite 바이트, frontend/src/WooriLocal.ts).
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(WooriBarsPlugin.class);
        super.onCreate(savedInstanceState);
        // 시스템 글꼴 크기(설정 > 글꼴 크기)를 웹뷰 글자 확대로 따르지 않는다: 레이아웃이 360dp 기준 절대 위치 + px 줄 높이라
        // 글자만 커지면 겹치고 잘린다 (웹뷰 기본 textZoom = 100 × fontScale). 매니페스트 configChanges 에 fontScale 이 있어
        // 글꼴 크기를 바꿔도 액티비티를 다시 만들지 않는다(앱이 처음 화면으로 돌아가지 않는다).
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().getSettings().setTextZoom(100);
        }
    }
}
