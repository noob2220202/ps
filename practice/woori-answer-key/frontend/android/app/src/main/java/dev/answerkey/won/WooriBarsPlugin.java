package dev.answerkey.won;

import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.ColorFilter;
import android.graphics.Paint;
import android.graphics.PixelFormat;
import android.graphics.Rect;
import android.graphics.drawable.Drawable;
import android.view.View;
import android.view.Window;
import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 진짜 상태바·내비 바 뒤의 색. 웹뷰는 SystemBars(insetsHandling 'native', viewport-fit=cover 없음) 덕에 두 바 사이에만 놓이고,
 * 바 자리에는 DecorView 의 안쪽 여백(padding)이 보인다 → 그 여백을 화면이 바라는 띠 색(WooriTheme 의 statusbar · navbar)으로 칠한다.
 * 색이 어두우면 바 아이콘을 밝게 바꾼다. JS: registerPlugin('WooriBars').setColors({ statusBar: '#rrggbb', navBar: '#rrggbb' })
 */
@CapacitorPlugin(name = "WooriBars")
public class WooriBarsPlugin extends Plugin {

    private BandDrawable band;

    @Override
    public void load() {
        getActivity().runOnUiThread(() -> {
            View decor = getActivity().getWindow().getDecorView();
            band = new BandDrawable(decor);
            decor.setBackground(band);
        });
    }

    @PluginMethod
    public void setColors(PluginCall call) {
        final int status = parse(call.getString("statusBar"), Color.WHITE);
        final int nav = parse(call.getString("navBar"), status);
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            View decor = window.getDecorView();
            if (band == null) {
                band = new BandDrawable(decor);
                decor.setBackground(band);
            }
            band.setColors(status, nav);
            WindowInsetsControllerCompat c = WindowCompat.getInsetsController(window, decor);
            c.setAppearanceLightStatusBars(isLight(status));
            c.setAppearanceLightNavigationBars(isLight(nav));
            call.resolve();
        });
    }

    private static int parse(@Nullable String s, int fallback) {
        if (s == null) return fallback;
        try {
            return Color.parseColor(s.trim());
        } catch (IllegalArgumentException e) {
            return fallback;
        }
    }

    private static boolean isLight(int c) {
        double l = 0.2126 * Color.red(c) + 0.7152 * Color.green(c) + 0.0722 * Color.blue(c);
        return l >= 140;
    }

    /** 위 여백(상태바) · 아래 여백(내비 바 또는 키보드) 을 각자 색으로 칠한다 */
    static final class BandDrawable extends Drawable {

        private final View host;
        private final Paint paint = new Paint();
        private int status = Color.WHITE;
        private int nav = Color.WHITE;

        BandDrawable(View host) {
            this.host = host;
        }

        void setColors(int status, int nav) {
            this.status = status;
            this.nav = nav;
            invalidateSelf();
        }

        @Override
        public void draw(@NonNull Canvas canvas) {
            Rect b = getBounds();
            int top = host.getPaddingTop();
            int bottom = host.getPaddingBottom();
            paint.setColor(status);
            canvas.drawRect(b.left, b.top, b.right, b.bottom - bottom, paint);
            paint.setColor(nav);
            canvas.drawRect(b.left, b.bottom - bottom, b.right, b.bottom, paint);
            if (top == 0 && bottom == 0) {
                paint.setColor(status);
                canvas.drawRect(b, paint);
            }
        }

        @Override
        public void setAlpha(int alpha) {}

        @Override
        public void setColorFilter(@Nullable ColorFilter colorFilter) {}

        @Override
        @SuppressWarnings("deprecation")
        public int getOpacity() {
            return PixelFormat.OPAQUE;
        }
    }
}
