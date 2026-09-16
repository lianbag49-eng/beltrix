package io.beltrix.android;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Environment;
import android.os.SystemClock;
import android.view.MotionEvent;
import org.json.JSONArray;
import android.webkit.ValueCallback;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.espresso.intent.Intents;
import androidx.test.espresso.intent.matcher.IntentMatchers;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import java.io.FileOutputStream;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;
import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.action.ViewActions.click;
import static androidx.test.espresso.assertion.ViewAssertions.matches;
import static androidx.test.espresso.matcher.ViewMatchers.*;
import static org.hamcrest.Matchers.*;

@RunWith(AndroidJUnit4.class)
public class NativeShellTest {
    ActivityScenario<MainActivity> scenario;
    @Before public void start()throws Exception{
        Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();
        c.getSharedPreferences("MainActivity",Context.MODE_PRIVATE).edit().putBoolean("previewAcknowledged",true).commit();
        Intents.init();
        Intents.intending(IntentMatchers.hasAction(Intent.ACTION_VIEW)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_CANCELED,null));
        Intents.intending(IntentMatchers.hasAction(Intent.ACTION_OPEN_DOCUMENT)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_CANCELED,null));
        Intents.intending(IntentMatchers.hasAction(Intent.ACTION_CREATE_DOCUMENT)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_CANCELED,null));
        scenario=ActivityScenario.launch(MainActivity.class);
        waitFor("document.documentElement.dataset.androidPreview==='1' && !!document.getElementById('walletUsdtEntry')");
    }
    @After public void finish(){if(scenario!=null)scenario.close();Intents.release();}
    private String js(String script)throws Exception{
        CountDownLatch done=new CountDownLatch(1);AtomicReference<String> result=new AtomicReference<>();
        scenario.onActivity(a->a.webView().evaluateJavascript(script,value->{result.set(value);done.countDown();}));
        assertTrue("JavaScript callback timed out",done.await(20,TimeUnit.SECONDS));return result.get();
    }
    private void waitFor(String expression)throws Exception{
        long end=System.currentTimeMillis()+45000;String last="";
        while(System.currentTimeMillis()<end){last=js("Boolean("+expression+")");if("true".equals(last))return;Thread.sleep(150);}
        fail("Not ready: "+expression+" => "+last);
    }
    private void awaitText(String text)throws Exception{long end=System.currentTimeMillis()+15000;while(System.currentTimeMillis()<end){try{onView(withText(text)).check(matches(isDisplayed()));return;}catch(Exception|AssertionError e){Thread.sleep(100);}}onView(withText(text)).check(matches(isDisplayed()));}
    private void tapWeb(String selector)throws Exception{
        js("document.querySelector("+org.json.JSONObject.quote(selector)+").scrollIntoView({block:'center'})");Thread.sleep(200);
        String raw=js("JSON.stringify((()=>{const r=document.querySelector("+org.json.JSONObject.quote(selector)+").getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2,devicePixelRatio]})())");
        JSONArray coords=new JSONArray(new org.json.JSONTokener(raw).nextValue().toString());
        int[] screen=new int[2];scenario.onActivity(a->a.webView().getLocationOnScreen(screen));
        float x=screen[0]+(float)(coords.getDouble(0)*coords.getDouble(2)),y=screen[1]+(float)(coords.getDouble(1)*coords.getDouble(2));
        long now=SystemClock.uptimeMillis();Instrumentation i=InstrumentationRegistry.getInstrumentation();
        MotionEvent down=MotionEvent.obtain(now,now,MotionEvent.ACTION_DOWN,x,y,0),up=MotionEvent.obtain(now,now+80,MotionEvent.ACTION_UP,x,y,0);i.sendPointerSync(down);i.sendPointerSync(up);down.recycle();up.recycle();Thread.sleep(300);
    }
    private void openUsdt()throws Exception{js("document.getElementById('walletUsdtEntry').click()");waitFor("document.getElementById('usdtDialog')?.open && document.getElementById('usdtNetwork')?.options.length===8");}
    private void receiveQr()throws Exception{
        openUsdt();js("document.getElementById('usdtWatchAddress').value='0x1111111111111111111111111111111111111111';document.getElementById('usdtWatch').click()");
        waitFor("document.getElementById('usdtQR')?.width>100");Thread.sleep(300);
    }
    private void screenshot(String name)throws Exception{
        Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();File dir=new File(c.getExternalFilesDir(null),"screenshots");dir.mkdirs();
        Bitmap shot=InstrumentationRegistry.getInstrumentation().getUiAutomation().takeScreenshot();
        try(FileOutputStream out=new FileOutputStream(new File(dir,name+".png"))){assertTrue(shot.compress(Bitmap.CompressFormat.PNG,100,out));}shot.recycle();
    }
    @Test public void packagedUiAndNoSigner()throws Exception{
        assertEquals("true",js("location.origin==='https://appassets.androidplatform.net' && !window.ethereum && !window.tronWeb && !window.solana"));
        assertEquals("true",js("document.documentElement.dataset.simpleTrade==='v1'"));
        js("window.openPage('markets')");waitFor("document.getElementById('futuresLong')?.disabled");
        assertEquals("true",js("document.getElementById('futuresShort').disabled"));screenshot("android-perps");
        js("document.querySelector('[data-trade-product=spot]').click()");waitFor("document.getElementById('marketType').value==='spot'");
        assertEquals("true",js("document.getElementById('futuresLong').disabled"));screenshot("android-spot");
    }
    @Test public void walletButtonIsBrowseHandoffNotAConnection()throws Exception{
        onView(withContentDescription("Open external wallet")).perform(click());
        onView(withText("Continue in a wallet app")).check(matches(isDisplayed()));
        onView(withText("OKX Wallet · multi-chain")).perform(click());
        Intents.intended(allOf(IntentMatchers.hasAction(Intent.ACTION_VIEW),IntentMatchers.hasData(startsWith("https://www.okx.com/download?deeplink="))));
        assertEquals("true",js("!window.ethereum && !window.tronWeb && !window.solana"));
    }
    @Test public void qrRenderAndSaveUsesAndroidDocumentPicker()throws Exception{
        receiveQr();screenshot("android-usdt-qr");js("document.getElementById('usdtSaveQR').click()");
        awaitText("Save");onView(withText("Save")).check(matches(isDisplayed())).perform(click());
        Intents.intended(allOf(IntentMatchers.hasAction(Intent.ACTION_CREATE_DOCUMENT),IntentMatchers.hasType("image/png")));
    }
    @Test public void qrImagePickerIsUserScopedAndCancellationSafe()throws Exception{
        openUsdt();js("document.querySelector('[data-usdt-tab=send]').click()");waitFor("!!document.getElementById('usdtQrFile')");
        js("document.getElementById('usdtQrFile').closest('details').open=true");tapWeb(".usdt-file");
        Intents.intended(allOf(IntentMatchers.hasAction(Intent.ACTION_OPEN_DOCUMENT),IntentMatchers.hasType("image/*")));
        assertEquals("true",js("document.getElementById('usdtQrFile').files.length===0 && document.getElementById('usdtReview').disabled"));
    }
    @Test public void clipboardRequiresNativeConfirmation()throws Exception{
        js("navigator.clipboard.writeText('PUBLIC TEST ADDRESS ONLY').catch(()=>{})");
        awaitText("Copy public details?");onView(withText("Copy public details?")).check(matches(isDisplayed()));onView(withText("Cancel")).perform(click());
    }
    @Test public void nativeBackClosesModalBeforePageNavigation()throws Exception{
        openUsdt();scenario.onActivity(MainActivity::onBackPressed);waitFor("!document.getElementById('usdtDialog').open");
        assertEquals("\"wallet\"",js("document.body.dataset.page"));
    }
    @Test public void webSettingsAndEndpointProtection()throws Exception{
        scenario.onActivity(a->{assertFalse(a.webView().getSettings().getAllowFileAccess());assertFalse(a.webView().getSettings().getAllowContentAccess());assertEquals(android.webkit.WebSettings.MIXED_CONTENT_NEVER_ALLOW,a.webView().getSettings().getMixedContentMode());});
        js("window.nativeWriteProbe='waiting';fetch('https://api.hyperliquid.xyz/exchange',{method:'POST',body:'{}'}).then(r=>window.nativeWriteProbe=String(r.status)).catch(()=>window.nativeWriteProbe='blocked')");
        waitFor("window.nativeWriteProbe!=='waiting'");assertEquals("true",js("['403','blocked'].includes(window.nativeWriteProbe)"));
    }
}
