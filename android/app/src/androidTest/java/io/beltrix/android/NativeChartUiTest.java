package io.beltrix.android;

import android.content.Context;
import android.webkit.WebView;
import android.os.SystemClock;
import android.graphics.Bitmap;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import java.io.FileOutputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;

/** Read-only packaged chart navigation. No wallet, simulated feed or exchange writes. */
@RunWith(AndroidJUnit4.class)
public class NativeChartUiTest {
    private ActivityScenario<MainActivity> scenario;
    private String js(String code)throws Exception{
        CountDownLatch done=new CountDownLatch(1);AtomicReference<String> value=new AtomicReference<>();
        scenario.onActivity(a->a.webView().evaluateJavascript(code,r->{value.set(r);done.countDown();}));
        assertTrue("JavaScript callback timed out",done.await(20,TimeUnit.SECONDS));return value.get();
    }
    private void ready(String expr)throws Exception{
        long end=System.currentTimeMillis()+30000;
        while(System.currentTimeMillis()<end){if("true".equals(js("Boolean("+expr+")")))return;Thread.sleep(150);}
        fail("Packaged chart did not satisfy: "+expr);
    }
    @Test public void blackGoldChartAndBackKeepTheOriginalInputAndRestoreIndicators()throws Exception{
        Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();
        c.getSharedPreferences(MainActivity.class.getName(),Context.MODE_PRIVATE).edit().putBoolean("previewAcknowledged",true).commit();
        scenario=ActivityScenario.launch(MainActivity.class);
        try{
            ready("document.documentElement.dataset.beltrixTheme==='black-gold' && !!document.getElementById('chartFullscreen')");
            js("window.openPage('markets');window.nativeOriginalSize=document.getElementById('tradeSize');nativeOriginalSize.value='0.25';document.getElementById('cleanOpenChart').click()");
            ready("document.getElementById('chartFullscreen').open && document.getElementById('marketCanvas').getBoundingClientRect().width>100");
            assertEquals("true",js("document.querySelectorAll('[data-chart-indicator]').length===6 && !window.ethereum && !window.tronWeb && !window.solana"));
            js("document.getElementById('chartResetSettings').click();document.querySelector('[data-chart-indicator=macd]').click()");
            ready("document.querySelector('[data-chart-indicator=macd]').getAttribute('aria-pressed')==='true'");
            js("document.getElementById('chartMuteIndicators').click()");ready("document.querySelector('[data-chart-indicator=macd]').getAttribute('aria-pressed')==='false'");
            js("document.getElementById('chartMuteIndicators').click()");ready("document.querySelector('[data-chart-indicator=macd]').getAttribute('aria-pressed')==='true'");
            CountDownLatch frame=new CountDownLatch(1);
            scenario.onActivity(a->a.webView().postVisualStateCallback(SystemClock.uptimeMillis(),new WebView.VisualStateCallback(){@Override public void onComplete(long id){frame.countDown();}}));
            assertTrue(frame.await(15,TimeUnit.SECONDS));Thread.sleep(250);
            File dir=new File(c.getExternalFilesDir(null),"screenshots");assertTrue(dir.isDirectory()||dir.mkdirs());
            Bitmap image=InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
            try(FileOutputStream out=new FileOutputStream(new File(dir,"android-black-gold-chart.png"))){assertTrue(image.compress(Bitmap.CompressFormat.PNG,100,out));}image.recycle();
            scenario.onActivity(a->a.getOnBackPressedDispatcher().onBackPressed());
            ready("!document.getElementById('chartFullscreen').open && !!document.getElementById('marketCanvas').closest('#futuresChart')");
            assertEquals("true",js("document.getElementById('tradeSize')===nativeOriginalSize && nativeOriginalSize.value==='0.25' && document.body.dataset.page==='markets'"));
            js("document.getElementById('cleanOpenChart').click()");ready("document.getElementById('chartFullscreen').open");
            assertEquals("true",js("document.querySelector('[data-chart-indicator=macd]').getAttribute('aria-pressed')==='true'"));
            scenario.onActivity(a->a.getOnBackPressedDispatcher().onBackPressed());ready("!document.getElementById('chartFullscreen').open");
            assertEquals("true",js("document.getElementById('futuresLong').disabled && document.getElementById('futuresShort').disabled"));
        }finally{scenario.close();}
    }
}
