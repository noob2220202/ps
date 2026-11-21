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
    }
}
