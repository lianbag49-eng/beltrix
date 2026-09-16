package io.beltrix.android;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.net.Uri;
import android.net.http.SslError;
import android.os.Build;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.GeolocationPermissions;
import android.webkit.PermissionRequest;
import android.webkit.SslErrorHandler;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;
import androidx.core.content.FileProvider;
import androidx.core.graphics.Insets;
import androidx.core.view.ViewCompat;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.webkit.JavaScriptReplyProxy;
import androidx.webkit.WebMessageCompat;
import androidx.webkit.WebViewAssetLoader;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import org.json.JSONObject;
import java.io.ByteArrayInputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Collections;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/** Installable, non-custodial Android preview. There is deliberately no signing bridge. */
public final class MainActivity extends Activity {
    private static final int PICK_IMAGE=101, SAVE_FILE=102;
    private final ExecutorService io=Executors.newSingleThreadExecutor();
    private WebView web;
    private ProgressBar progress;
    private ValueCallback<Uri[]> fileCallback;
    private Export pendingExport;
    private boolean nativeBusy;
    private AlertDialog nativeDialog;
    private int documentEpoch;

    private static final class Export {
        final byte[] bytes; final String name,mime,id; final JavaScriptReplyProxy reply;
        Export(byte[] bytes,String name,String mime,String id,JavaScriptReplyProxy reply){this.bytes=bytes;this.name=name;this.mime=mime;this.id=id;this.reply=reply;}
    }
    WebView webView(){return web;}
    private int dp(int n){return Math.round(n*getResources().getDisplayMetrics().density);}
    private void toast(String text){Toast.makeText(this,text,Toast.LENGTH_LONG).show();}
    private Button button(String label,String description){Button b=new Button(this);b.setText(label);b.setTextSize(12);b.setTextColor(Color.rgb(230,190,114));b.setContentDescription(description);b.setMinWidth(dp(48));b.setMinimumWidth(dp(48));b.setPadding(dp(8),0,dp(8),0);return b;}

    @SuppressLint("SetJavaScriptEnabled")
    @Override public void onCreate(Bundle savedState){
        super.onCreate(savedState);
        WindowCompat.setDecorFitsSystemWindows(getWindow(),false);
        LinearLayout root=new LinearLayout(this);root.setOrientation(LinearLayout.VERTICAL);root.setBackgroundColor(Color.rgb(9,12,16));
        ViewCompat.setOnApplyWindowInsetsListener(root,(v,insets)->{
            Insets i=insets.getInsets(WindowInsetsCompat.Type.systemBars()|WindowInsetsCompat.Type.displayCutout()|WindowInsetsCompat.Type.ime());
            v.setPadding(i.left,i.top,i.right,i.bottom);return WindowInsetsCompat.CONSUMED;
        });
        LinearLayout top=new LinearLayout(this);top.setGravity(Gravity.CENTER_VERTICAL);top.setPadding(dp(12),0,dp(8),0);
        TextView title=new TextView(this);title.setText("ANDROID PREVIEW");title.setTextSize(11);title.setTextColor(Color.LTGRAY);top.addView(title,new LinearLayout.LayoutParams(0,dp(48),1));title.setGravity(Gravity.CENTER_VERTICAL);
        Button wallet=button("Wallet","Open external wallet");wallet.setOnClickListener(v->walletChooser());top.addView(wallet,new LinearLayout.LayoutParams(dp(80),dp(48)));
        Button menu=button("⋮","App menu");menu.setTextSize(22);menu.setOnClickListener(v->menu());top.addView(menu,new LinearLayout.LayoutParams(dp(48),dp(48)));
        root.addView(top);
        TextView scope=new TextView(this);scope.setText("View markets and receive QR here. Signing continues in your wallet app.");scope.setTextColor(Color.rgb(190,178,153));scope.setTextSize(11);scope.setPadding(dp(12),dp(4),dp(12),dp(8));root.addView(scope);
        progress=new ProgressBar(this,null,android.R.attr.progressBarStyleHorizontal);progress.setMax(100);root.addView(progress,new LinearLayout.LayoutParams(-1,dp(2)));
        web=new WebView(this);web.setBackgroundColor(Color.rgb(9,12,16));root.addView(web,new LinearLayout.LayoutParams(-1,0,1));setContentView(root);
        WebView.setWebContentsDebuggingEnabled(false);
        WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);
        s.setAllowFileAccess(false);s.setAllowContentAccess(false);s.setAllowFileAccessFromFileURLs(false);s.setAllowUniversalAccessFromFileURLs(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);s.setSafeBrowsingEnabled(true);
        s.setJavaScriptCanOpenWindowsAutomatically(false);s.setSupportMultipleWindows(false);s.setGeolocationEnabled(false);
        s.setMediaPlaybackRequiresUserGesture(true);s.setBuiltInZoomControls(false);s.setDisplayZoomControls(false);
        s.setUserAgentString(s.getUserAgentString()+" BELTRIXAndroid/"+BuildConfig.VERSION_NAME);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web,false);
        WebViewAssetLoader assets=new WebViewAssetLoader.Builder().addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient(){
            @Override public WebResourceResponse shouldInterceptRequest(WebView view,WebResourceRequest r){
                String url=r.getUrl().toString();
                if(NavigationPolicy.trustedOrigin(url)){
                    String path=r.getUrl().getPath();
                    if(path==null||!path.startsWith("/assets/beltrix/")||path.contains("..")||r.getUrl().getEncodedPath().contains("%"))return blocked(404);
                    WebResourceResponse response=assets.shouldInterceptRequest(r.getUrl());
                    if(response==null)return blocked(404);
                    Map<String,String> headers=new HashMap<>();
                    headers.put("X-Content-Type-Options","nosniff");headers.put("Referrer-Policy","no-referrer");
                    headers.put("Content-Security-Policy","default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data: blob:; connect-src https: wss:; object-src 'none'; frame-src 'none'; base-uri 'none'; form-action 'none'; worker-src 'none'");
                    response.setResponseHeaders(headers);return response;
                }
                if(r.isForMainFrame()||!"https".equals(r.getUrl().getScheme())||NavigationPolicy.writeEndpoint(url))return blocked(403);
                return null;
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view,WebResourceRequest r){
                if(!r.isForMainFrame())return true;
                String url=r.getUrl().toString();if(NavigationPolicy.internalPage(url))return false;
                if(r.hasGesture())confirmExternal(url);return true;
            }
            @Override public void onPageStarted(WebView view,String url,android.graphics.Bitmap favicon){documentEpoch++;progress.setVisibility(View.VISIBLE);}
            @Override public void onPageFinished(WebView view,String url){progress.setVisibility(View.GONE);}
            @Override public void onReceivedSslError(WebView view,SslErrorHandler handler,SslError error){handler.cancel();toast("Secure connection failed. No certificate bypass is allowed.");}
            @Override public boolean onRenderProcessGone(WebView view,android.webkit.RenderProcessGoneDetail detail){
                ((ViewGroup)view.getParent()).removeView(view);view.destroy();web=null;
                new AlertDialog.Builder(MainActivity.this).setTitle("WebView stopped").setMessage("Reopen the app. A submitted request is not cancelled by closing this screen.").setPositiveButton("Close",(d,w)->finish()).setCancelable(false).show();return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient(){
            @Override public void onProgressChanged(WebView view,int percent){progress.setProgress(percent);}
            @Override public void onPermissionRequest(PermissionRequest request){request.deny();}
            @Override public void onGeolocationPermissionsShowPrompt(String origin,GeolocationPermissions.Callback callback){callback.invoke(origin,false,false);}
            @Override public boolean onShowFileChooser(WebView view,ValueCallback<Uri[]> callback,FileChooserParams params){
                if(!NavigationPolicy.internalPage(view.getUrl())||params.getMode()!=FileChooserParams.MODE_OPEN){callback.onReceiveValue(null);return true;}
                if(fileCallback!=null)fileCallback.onReceiveValue(null);fileCallback=callback;
                Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("image/*");
                i.putExtra(Intent.EXTRA_MIME_TYPES,new String[]{"image/png","image/jpeg","image/webp"});i.putExtra(Intent.EXTRA_ALLOW_MULTIPLE,false);
                try{startActivityForResult(i,PICK_IMAGE);}catch(Exception e){finishImage(null);toast("No system image picker is available.");}return true;
            }
        });
        web.setDownloadListener((url,agent,disposition,mime,length)->toast("Use the QR Save or Share button. Arbitrary downloads are blocked."));
        if(WebViewFeature.isFeatureSupported(WebViewFeature.WEB_MESSAGE_LISTENER)){
            WebViewCompat.addWebMessageListener(web,"BeltrixAndroid",Collections.singleton(NavigationPolicy.ORIGIN),(view,message,origin,main,reply)->{
                if(!main||!NavigationPolicy.trustedOrigin(origin.toString())||!NavigationPolicy.internalPage(view.getUrl()))return;
                String data=message.getData();if(data==null||data.length()>3*1024*1024)return;
                try{handleMessage(new JSONObject(data),reply);}catch(Exception e){toast("Native action rejected: "+e.getMessage());}
            });
        }else toast("Update Android System WebView for QR export and wallet handoff.");
        if(savedState==null||web.restoreState(savedState)==null)web.loadUrl(NavigationPolicy.HOME+"#wallet");
        if(Build.VERSION.SDK_INT>=33)getOnBackInvokedDispatcher().registerOnBackInvokedCallback(android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT,this::handleBack);
        if(!getPreferences(MODE_PRIVATE).getBoolean("previewAcknowledged",false)){
            nativeDialog=new AlertDialog.Builder(this).setTitle("BELTRIX Android preview")
                .setMessage("This APK contains the reviewed web interface. Use public addresses for balances and receive QR.\n\nSigning is NOT built into this APK. Open BELTRIX in your wallet app for orders and sends. App and wallet-browser history are separate. Returning here does not confirm a transfer.\n\nNo seed phrase or private key is required. Real-device, funded transfer and independent security validation are still pending.")
                .setPositiveButton("Continue",(d,w)->getPreferences(MODE_PRIVATE).edit().putBoolean("previewAcknowledged",true).apply()).setCancelable(false).show();
        }
    }
    private WebResourceResponse blocked(int status){return new WebResourceResponse("text/plain","UTF-8",status,status==404?"Not found":"Blocked",Collections.singletonMap("Cache-Control","no-store"),new ByteArrayInputStream("Unavailable in Android preview".getBytes(StandardCharsets.UTF_8)));}
    private void respond(JavaScriptReplyProxy reply,String id,boolean ok,String value){
        try{JSONObject out=new JSONObject().put("id",id).put("ok",ok).put(ok?"value":"error",value);reply.postMessage(out.toString());}catch(Exception ignored){/* Never replay an action after a document closes. */}
    }
    private void handleMessage(JSONObject o,JavaScriptReplyProxy reply)throws Exception{
        String id=o.optString("id"),action=o.optString("action");if(!id.matches("[0-9]{1,12}"))return;
        if(nativeBusy||pendingExport!=null){respond(reply,id,false,"Complete the current Android prompt first");return;}
        switch(action){
            case "wallet" -> {walletChooser();respond(reply,id,true,"Wallet chooser opened; no wallet is connected to the APK");}
            case "openExternal" -> {confirmExternal(o.optString("url"));respond(reply,id,true,"External link review opened");}
            case "copy", "shareText" -> {
                String text=ExportPolicy.text(o.optString("text"));nativeBusy=true;
                nativeDialog=new AlertDialog.Builder(this).setTitle(action.equals("copy")?"Copy public details?":"Share public details?").setMessage(text)
                    .setPositiveButton(action.equals("copy")?"Copy":"Share",(d,w)->{
                        if(action.equals("copy")){((ClipboardManager)getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("BELTRIX",text));respond(reply,id,true,"Copied");}
                        else {try{startActivity(Intent.createChooser(new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT,text),"Share BELTRIX details"));respond(reply,id,true,"Share chooser opened");}catch(Exception e){respond(reply,id,false,"No sharing app is available");}}
                    }).setNegativeButton("Cancel",(d,w)->respond(reply,id,false,"Cancelled")).setOnCancelListener(d->respond(reply,id,false,"Cancelled")).create();
                nativeDialog.setOnDismissListener(d->nativeBusy=false);nativeDialog.show();
            }
            case "export" -> {
                String mime=o.optString("mime");byte[] bytes=ExportPolicy.decode(o.optString("base64"),mime);
                if("image/png".equals(mime)){BitmapFactory.Options options=new BitmapFactory.Options();options.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(bytes,0,bytes.length,options);if(options.outWidth<=0||options.outHeight<=0)throw new IllegalArgumentException("Invalid PNG");}
                Export e=new Export(bytes,ExportPolicy.filename(o.optString("name"),mime),mime,id,reply);nativeBusy=true;
                nativeDialog=new AlertDialog.Builder(this).setTitle("Export "+e.name).setMessage("Save or share these public details. A receive QR is not proof of ownership or payment. Check the network shown in the QR image.")
                    .setPositiveButton("Save",(d,w)->saveExport(e)).setNeutralButton("Share",(d,w)->shareExport(e))
                    .setNegativeButton("Cancel",(d,w)->respond(reply,id,false,"Cancelled")).setOnCancelListener(d->respond(reply,id,false,"Cancelled")).create();
                nativeDialog.setOnDismissListener(d->nativeBusy=false);nativeDialog.show();
            }
            default -> respond(reply,id,false,"Unsupported native action");
        }
    }
    private void confirmExternal(String raw){
        if(!NavigationPolicy.externalHttps(raw)){toast("Only reviewed HTTPS links may open outside the app.");return;}
        if(nativeBusy)return;nativeBusy=true;
        nativeDialog=new AlertDialog.Builder(this).setTitle("Open outside BELTRIX?").setMessage(raw+"\n\nCheck this address in the browser. No signing data is sent by this action.")
            .setPositiveButton("Open",(d,w)->launch(Uri.parse(raw))).setNegativeButton("Cancel",null).create();
        nativeDialog.setOnDismissListener(d->nativeBusy=false);nativeDialog.show();
    }
    private void launch(Uri uri){try{startActivity(new Intent(Intent.ACTION_VIEW,uri).addCategory(Intent.CATEGORY_BROWSABLE));}catch(Exception e){toast("No compatible app found. Copy the BELTRIX URL from the menu and open it in your wallet browser.");}}
    private void walletChooser(){
        if(nativeBusy||web==null)return;nativeBusy=true;final String current=web.getUrl();
        nativeDialog=new AlertDialog.Builder(this).setTitle("Continue in a wallet app")
            .setItems(new String[]{"OKX Wallet · multi-chain","MetaMask · EVM","TronLink · TRON","Phantom · Solana"},(d,index)->{
                String[] names={"okx","metamask","tronlink","phantom"};launch(Uri.parse(NavigationPolicy.walletBrowse(names[index],current)));
                toast("Review and connect inside the wallet. No transaction or approval is carried over from this preview.");
            }).setNegativeButton("Cancel",null).create();nativeDialog.setOnDismissListener(d->nativeBusy=false);nativeDialog.show();
    }
    private void menu(){
        if(nativeBusy||web==null)return;
        String[] labels={"Reload view","Copy web address","Open web version","About this APK"};
        new AlertDialog.Builder(this).setTitle("BELTRIX Preview").setItems(labels,(d,i)->{
            if(i==0)new AlertDialog.Builder(this).setTitle("Reload this view?").setMessage("This does not cancel a submitted transaction or clear its journal.").setPositiveButton("Reload",(x,y)->web.reload()).setNegativeButton("Cancel",null).show();
            if(i==1){((ClipboardManager)getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("BELTRIX",NavigationPolicy.publicPage(web.getUrl())));toast("Web address copied");}
            if(i==2)confirmExternal(NavigationPolicy.publicPage(web.getUrl()));
            if(i==3)new AlertDialog.Builder(this).setTitle("BELTRIX "+BuildConfig.VERSION_NAME).setMessage("Android-only preview\nSource: "+BuildConfig.SOURCE_SHA+"\n\nPackaged UI, public-address watch mode, QR files and external wallet handoff. No private keys, in-app wallet signer or automatic transfer callbacks. No background transaction monitoring.\n\nTest-signed APK, not Play Store release. Future builds may need reinstalling until a permanent signing key is configured. Browser data is isolated from your wallet browser. Do not erase data for an unresolved submission.\n\nNot independently audited or funded/physical-device validated.").setPositiveButton("OK",null).show();
        }).show();
    }
    private void saveExport(Export e){
        pendingExport=e;Intent i=new Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType(e.mime).putExtra(Intent.EXTRA_TITLE,e.name);
        try{startActivityForResult(i,SAVE_FILE);}catch(Exception x){pendingExport=null;respond(e.reply,e.id,false,"No document saver available");}
    }
    private void shareExport(Export e){
        pendingExport=e;io.execute(()->{try{
            File dir=new File(getCacheDir(),"exports");if(!dir.isDirectory()&&!dir.mkdirs())throw new java.io.IOException("Cannot create export directory");
            File file=new File(dir,UUID.randomUUID()+"-"+e.name);try(OutputStream out=new FileOutputStream(file)){out.write(e.bytes);}
            Uri uri=FileProvider.getUriForFile(this,BuildConfig.APPLICATION_ID+".files",file);
            runOnUiThread(()->{pendingExport=null;if(isFinishing()||isDestroyed())return;
                try{Intent i=new Intent(Intent.ACTION_SEND).setType(e.mime).putExtra(Intent.EXTRA_STREAM,uri).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);i.setClipData(ClipData.newUri(getContentResolver(),e.name,uri));startActivity(Intent.createChooser(i,"Share "+e.name));respond(e.reply,e.id,true,"Share chooser opened");}catch(Exception x){respond(e.reply,e.id,false,"No sharing app available");}
            });
        }catch(Exception x){runOnUiThread(()->{pendingExport=null;respond(e.reply,e.id,false,"File export failed");});}});
    }
    private void finishImage(Uri uri){ValueCallback<Uri[]> c=fileCallback;fileCallback=null;if(c!=null)c.onReceiveValue(uri==null?null:new Uri[]{uri});}
    @Override protected void onActivityResult(int request,int result,Intent data){
        super.onActivityResult(request,result,data);
        Uri selected=data==null?null:data.getData();
        if(request==PICK_IMAGE){
            if(result!=RESULT_OK||selected==null||!"content".equals(selected.getScheme())){finishImage(null);return;}
            final int epoch=documentEpoch;
            io.execute(()->{try{
                byte[] bytes;try(InputStream in=getContentResolver().openInputStream(selected)){bytes=ExportPolicy.boundedRead(in,ExportPolicy.IMAGE_LIMIT);}
                String mime=ExportPolicy.imageMime(bytes);BitmapFactory.Options options=new BitmapFactory.Options();options.inJustDecodeBounds=true;BitmapFactory.decodeByteArray(bytes,0,bytes.length,options);
                if(options.outWidth<=0||options.outHeight<=0||options.outWidth>8192||options.outHeight>8192||(long)options.outWidth*options.outHeight>20000000L)throw new IllegalArgumentException("Image dimensions are too large");
                File dir=new File(getCacheDir(),"imports");if(!dir.isDirectory()&&!dir.mkdirs())throw new java.io.IOException("Cannot prepare image");
                File file=new File(dir,UUID.randomUUID()+ (mime.equals("image/png")?".png":mime.equals("image/jpeg")?".jpg":".webp"));try(OutputStream out=new FileOutputStream(file)){out.write(bytes);}
                Uri clean=FileProvider.getUriForFile(this,BuildConfig.APPLICATION_ID+".files",file);
                runOnUiThread(()->finishImage(epoch==documentEpoch?clean:null));
            }catch(Exception x){runOnUiThread(()->{finishImage(null);toast("Cannot import QR image: "+x.getMessage());});}});
        }
        if(request==SAVE_FILE&&pendingExport!=null){
            Export e=pendingExport;
            if(result!=RESULT_OK||selected==null||!"content".equals(selected.getScheme())){pendingExport=null;respond(e.reply,e.id,false,"Save cancelled");return;}
            io.execute(()->{boolean ok=false;try(OutputStream out=getContentResolver().openOutputStream(selected,"wt")){if(out==null)throw new java.io.IOException("Destination unavailable");out.write(e.bytes);out.flush();ok=true;}catch(Exception ignored){}
                final boolean success=ok;runOnUiThread(()->{pendingExport=null;respond(e.reply,e.id,success,success?"Saved":"Save failed");toast(success?"Saved "+e.name:"File could not be saved");});});
        }
    }
    private void handleBack(){
        if(web==null){finish();return;}
        web.evaluateJavascript("window.BeltrixNative?.back?.() || 'unhandled'",result->{
            if("\"handled\"".equals(result))return;
            if(web!=null&&web.canGoBack())web.goBack();else moveTaskToBack(true);
        });
    }
    @Override public void onBackPressed(){handleBack();}
    @Override protected void onSaveInstanceState(Bundle out){if(web!=null)web.saveState(out);super.onSaveInstanceState(out);}
    @Override protected void onResume(){super.onResume();if(web!=null)web.onResume();/* Never reload or infer transaction success on return. */}
    @Override protected void onPause(){if(web!=null)web.onPause();super.onPause();}
    @Override protected void onDestroy(){if(nativeDialog!=null)nativeDialog.dismiss();finishImage(null);io.shutdown();if(web!=null){((ViewGroup)web.getParent()).removeView(web);web.destroy();web=null;}super.onDestroy();}
}
