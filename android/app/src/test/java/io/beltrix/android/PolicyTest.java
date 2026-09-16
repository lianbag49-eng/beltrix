package io.beltrix.android;
import org.junit.Test;
import static org.junit.Assert.*;
import java.io.ByteArrayInputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.Base64;

public class PolicyTest {
    @Test public void exactPackagedOriginAndPage(){
        assertTrue(NavigationPolicy.internalPage(NavigationPolicy.HOME+"#markets"));
        assertTrue(NavigationPolicy.trustedOrigin(NavigationPolicy.ORIGIN));
        for(String url:new String[]{"http://appassets.androidplatform.net/assets/beltrix/index.html","https://appassets.androidplatform.net.evil.test/assets/beltrix/index.html","https://appassets.androidplatform.net@evil.test/assets/beltrix/index.html","https://evil.test@appassets.androidplatform.net/assets/beltrix/index.html","https://appassets.androidplatform.net:444/assets/beltrix/index.html","https://appassets.androidplatform.net/assets/beltrix/%69ndex.html","https://appassets.androidplatform.net/assets/beltrix/../index.html","javascript:alert(1)","file:///data/data/private","content://provider/key",null})assertFalse(String.valueOf(url),NavigationPolicy.internalPage(url));
    }
    @Test public void externalLinksRejectSchemesCredentialsAndNewlines(){
        assertTrue(NavigationPolicy.externalHttps("https://example.com/path?x=1#abc"));
        for(String url:new String[]{"intent://wallet/#Intent;end","javascript:alert(1)","http://example.com/","file:///private","data:text/html,test","https://user:pass@example.com/","https://example.com\\@evil.test/","https://example.com/\nheader","https://example.com:8443/",NavigationPolicy.HOME})assertFalse(url,NavigationPolicy.externalHttps(url));
    }
    @Test public void handoffNeverCarriesTransactionInputs(){
        String current=NavigationPolicy.HOME+"?recipient=evil&amount=100&seed=secret#markets";
        for(String name:new String[]{"okx","metamask","tronlink","phantom"}){
            String link=NavigationPolicy.walletBrowse(name,current),decoded=URLDecoder.decode(URLDecoder.decode(link,StandardCharsets.UTF_8),StandardCharsets.UTF_8);
            assertTrue(name,decoded.contains("lianbag49-eng.github.io/beltrix/#markets"));
            assertFalse(decoded.contains("recipient="));assertFalse(decoded.contains("amount="));assertFalse(decoded.contains("seed="));assertFalse(decoded.contains("appassets"));
        }
    }
    @Test public void routeAllowlistAndWriteEndpoints(){
        assertEquals("wallet",NavigationPolicy.route(NavigationPolicy.HOME+"#javascript:alert(1)"));
        assertTrue(NavigationPolicy.writeEndpoint("https://api.hyperliquid.xyz/exchange"));
        assertTrue(NavigationPolicy.writeEndpoint("https://api.trongrid.io/wallet/broadcasttransaction"));
        assertFalse(NavigationPolicy.writeEndpoint("https://api.hyperliquid.xyz/info"));
        assertThrows(IllegalArgumentException.class,()->NavigationPolicy.walletBrowse("evil",NavigationPolicy.HOME));
    }
    @Test public void exportsRejectDangerousContent(){
        assertThrows(IllegalArgumentException.class,()->ExportPolicy.decode("PGh0bWw+","text/html"));
        assertThrows(IllegalArgumentException.class,()->ExportPolicy.decode("AAAA","image/png"));
        assertThrows(IllegalArgumentException.class,()->ExportPolicy.decode("%%%%","text/csv"));
        assertThrows(IllegalArgumentException.class,()->ExportPolicy.decode("a".repeat(3*1024*1024),"image/png"));
        assertThrows(IllegalArgumentException.class,()->ExportPolicy.decode("AA==","text/csv"));
        assertThrows(IllegalArgumentException.class,()->ExportPolicy.text("safe\u202Eevil"));
        assertThrows(IllegalArgumentException.class,()->ExportPolicy.text("x".repeat(8193)));
    }
    @Test public void boundedExportAndFilenames(){
        String csv="asset,amount\nUSDT,10\n";
        assertArrayEquals(csv.getBytes(StandardCharsets.UTF_8),ExportPolicy.decode(Base64.getEncoder().encodeToString(csv.getBytes(StandardCharsets.UTF_8)),"text/csv"));
        assertFalse(ExportPolicy.filename("../../private.apk","image/png").contains("/"));
        assertTrue(ExportPolicy.filename("private.apk","image/png").endsWith(".png"));
        assertTrue(ExportPolicy.filename("A".repeat(1000),"text/csv").length()<=84);
    }
    @Test public void imageSniffingAndReadLimits()throws Exception{
        assertEquals("image/jpeg",ExportPolicy.imageMime(new byte[]{(byte)255,(byte)216,(byte)255}));
        assertThrows(IllegalArgumentException.class,()->ExportPolicy.imageMime("<svg>test</svg>".getBytes()));
        assertThrows(java.io.IOException.class,()->ExportPolicy.boundedRead(new ByteArrayInputStream(new byte[20]),10));
        assertEquals(10,ExportPolicy.boundedRead(new ByteArrayInputStream(new byte[10]),10).length);
    }
}
