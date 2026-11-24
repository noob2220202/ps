package dev.answerkey.allone;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

/**
 * NH올원뱅크 (연습용, 배포하지 않음). 웹 앱(apk-allone/www)을 Capacitor 웹뷰로 띄운다 — 서버 없이 폰 안에서만 돈다
 * (서버 코드를 웹뷰 안에서 돌리고, 데이터는 웹뷰 IndexedDB 의 SQLite 바이트: bank-app-clone/src/apk/).
 * 상태바·내비 바는 Capacitor SystemBars(insetsHandling native) 기본 — 흰 바탕 + 어두운 아이콘이 올원뱅크의 흰 띠와 같다.
 */
public class MainActivity extends BridgeActivity {

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // 시스템 글꼴 크기를 웹뷰 글자 확대로 따르지 않는다: 화면이 393pt 기준 절대 위치라 글자만 커지면 겹치고 잘린다.
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().getSettings().setTextZoom(100);
        }
    }
}
