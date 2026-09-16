package io.beltrix.android;

import android.app.Activity;
import android.app.Instrumentation;
import android.content.Context;
import android.content.Intent;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.os.SystemClock;
import android.view.MotionEvent;
import androidx.core.content.FileProvider;
import androidx.test.core.app.ActivityScenario;
import androidx.test.platform.app.InstrumentationRegistry;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.espresso.intent.Intents;
import androidx.test.espresso.intent.matcher.IntentMatchers;
import org.json.JSONArray;
import org.json.JSONObject;
import org.json.JSONTokener;
import org.junit.After;
import org.junit.Before;
import org.junit.Test;
import org.junit.runner.RunWith;
import java.io.File;
import java.io.FileOutputStream;
import java.util.Base64;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;
import static org.junit.Assert.*;
import static androidx.test.espresso.Espresso.onView;
import static androidx.test.espresso.action.ViewActions.click;
import static androidx.test.espresso.matcher.ViewMatchers.withText;

/** Real native content-URI byte IO; only the user's document-picker selection is stubbed. */
@RunWith(AndroidJUnit4.class)
public class NativeFileRoundTripTest {
    private ActivityScenario<MainActivity> scenario;
    private File input, output;
    @Before public void start()throws Exception{
        Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();
        c.getSharedPreferences(MainActivity.class.getName(),Context.MODE_PRIVATE).edit().putBoolean("previewAcknowledged",true).commit();
        File dir=new File(c.getCacheDir(),"exports");assertTrue(dir.isDirectory()||dir.mkdirs());
        input=new File(dir,"test-selected-qr.png");output=new File(dir,"test-saved-qr.png");
        if(output.exists())assertTrue(output.delete());
        Uri source=FileProvider.getUriForFile(c,c.getPackageName()+".files",input),destination=FileProvider.getUriForFile(c,c.getPackageName()+".files",output);
        Intents.init();
        Intents.intending(IntentMatchers.hasAction(Intent.ACTION_OPEN_DOCUMENT)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_OK,new Intent().setData(source)));
        Intents.intending(IntentMatchers.hasAction(Intent.ACTION_CREATE_DOCUMENT)).respondWith(new Instrumentation.ActivityResult(Activity.RESULT_OK,new Intent().setData(destination)));
        scenario=ActivityScenario.launch(MainActivity.class);
        waitFor("!!document.getElementById('walletUsdtEntry') && !!window.BeltrixNative");
    }
    @After public void stop(){if(scenario!=null)scenario.close();Intents.release();if(input!=null)input.delete();if(output!=null)output.delete();}
    private String js(String s)throws Exception{
        CountDownLatch done=new CountDownLatch(1);AtomicReference<String> value=new AtomicReference<>();
        scenario.onActivity(a->a.webView().evaluateJavascript(s,r->{value.set(r);done.countDown();}));
        assertTrue(done.await(20,TimeUnit.SECONDS));return value.get();
    }
    private void waitFor(String s)throws Exception{
        long end=System.currentTimeMillis()+45000;
        while(System.currentTimeMillis()<end){if("true".equals(js("Boolean("+s+")")))return;Thread.sleep(150);}
        fail("Missing native file condition: "+s);
    }
    private void awaitSave()throws Exception {
        long end=System.currentTimeMillis()+15000;
        while(System.currentTimeMillis()<end){try{onView(withText("Save")).check(androidx.test.espresso.assertion.ViewAssertions.matches(androidx.test.espresso.matcher.ViewMatchers.isDisplayed()));return;}catch(Exception|AssertionError e){Thread.sleep(100);}}
        fail("Native Save confirmation did not appear");
    }
    private void tapWeb(String selector)throws Exception{
        js("document.querySelector("+JSONObject.quote(selector)+").scrollIntoView({block:'center'})");Thread.sleep(250);
        JSONArray p=new JSONArray(new JSONTokener(js("JSON.stringify((()=>{const r=document.querySelector("+JSONObject.quote(selector)+").getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2,devicePixelRatio]})())")).nextValue().toString());
        int[] screen=new int[2];scenario.onActivity(a->a.webView().getLocationOnScreen(screen));
        float x=screen[0]+(float)(p.getDouble(0)*p.getDouble(2)),y=screen[1]+(float)(p.getDouble(1)*p.getDouble(2));
        long now=SystemClock.uptimeMillis();Instrumentation i=InstrumentationRegistry.getInstrumentation();
        MotionEvent down=MotionEvent.obtain(now,now,MotionEvent.ACTION_DOWN,x,y,0),up=MotionEvent.obtain(now,now+70,MotionEvent.ACTION_UP,x,y,0);i.sendPointerSync(down);i.sendPointerSync(up);down.recycle();up.recycle();
    }
    @Test public void saveActualPngAndImportActualSelectedQrWithoutSigning()throws Exception{
        js("document.getElementById('walletUsdtEntry').click()");waitFor("!!document.getElementById('usdtWatchAddress')");
        js("document.getElementById('usdtWatchAddress').value='0x1111111111111111111111111111111111111111';document.getElementById('usdtWatch').click()");
        waitFor("document.getElementById('usdtQR')?.width===240");Thread.sleep(300);
        String uri=new JSONTokener(js("document.getElementById('usdtQR').toDataURL('image/png')")).nextValue().toString();
        try(FileOutputStream out=new FileOutputStream(input)){out.write(Base64.getDecoder().decode(uri.substring(uri.indexOf(',')+1)));}
        js("document.getElementById('usdtSaveQR').click()");awaitSave();onView(withText("Save")).perform(click());
        long end=System.currentTimeMillis()+15000;while(output.length()<100&&System.currentTimeMillis()<end)Thread.sleep(100);
        assertTrue("Native saver must write real PNG bytes",output.length()>100);
        BitmapFactory.Options dimensions=new BitmapFactory.Options();dimensions.inJustDecodeBounds=true;BitmapFactory.decodeFile(output.getAbsolutePath(),dimensions);
        assertTrue(dimensions.outWidth>=240);assertTrue(dimensions.outHeight>=240);
        js("document.querySelector('[data-usdt-tab=send]').click()");waitFor("!!document.getElementById('usdtQrFile')");
        js("document.getElementById('usdtQrFile').closest('details').open=true");tapWeb(".usdt-file");
        waitFor("document.getElementById('usdtRecipient').value==='0x1111111111111111111111111111111111111111'");
        assertEquals("true",js("document.getElementById('usdtReview').disabled && !window.ethereum"));
        Context c=InstrumentationRegistry.getInstrumentation().getTargetContext();File evidence=new File(c.getExternalFilesDir(null),"screenshots");evidence.mkdirs();
        try(FileOutputStream out=new FileOutputStream(new File(evidence,"native-file-roundtrip.json"))){out.write(new JSONObject().put("pngBytes",output.length()).put("pngWidth",dimensions.outWidth).put("pngHeight",dimensions.outHeight).put("contentUriImport","passed").put("walletConnected",false).toString().getBytes(java.nio.charset.StandardCharsets.UTF_8));}
    }
}
