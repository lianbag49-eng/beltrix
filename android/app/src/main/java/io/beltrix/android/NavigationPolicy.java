package io.beltrix.android;

import java.net.URI;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.Set;
import java.util.HashSet;
import java.util.Arrays;
import java.util.Collections;

/** Only packaged content gets native capabilities. All wallet links are browse-only. */
public final class NavigationPolicy {
    public static final String ORIGIN = "https://appassets.androidplatform.net";
    public static final String HOME = ORIGIN + "/assets/beltrix/index.html";
    public static final String PUBLIC_SITE = "https://lianbag49-eng.github.io/beltrix/";
    private static final Set<String> PAGES = Collections.unmodifiableSet(new HashSet<>(Arrays.asList("wallet", "markets", "swap", "settings", "explore", "defi", "boost")));
    private NavigationPolicy() {}

    private static URI parse(String raw) {
        if (raw == null || raw.length() > 4096 || raw.chars().anyMatch(c -> c <= 32 || c == 127 || c == '\\')) return null;
        try { return new URI(raw); } catch (Exception ignored) { return null; }
    }
    public static boolean trustedOrigin(String raw) {
        URI u = parse(raw);
        return u != null && "https".equals(u.getScheme()) && "appassets.androidplatform.net".equals(u.getHost())
            && u.getRawUserInfo() == null && u.getPort() == -1;
    }
    public static boolean internalPage(String raw) {
        URI u = parse(raw);
        return trustedOrigin(raw) && "/assets/beltrix/index.html".equals(u.getRawPath());
    }
    public static boolean externalHttps(String raw) {
        URI u = parse(raw);
        return u != null && "https".equals(u.getScheme()) && u.getHost() != null
            && u.getRawUserInfo() == null && (u.getPort() == -1 || u.getPort() == 443)
            && !"appassets.androidplatform.net".equals(u.getHost());
    }
    public static String route(String raw) {
        URI u = parse(raw);
        String hash = u == null ? null : u.getFragment();
        return PAGES.contains(hash == null ? "" : hash) ? hash : "wallet";
    }
    public static String publicPage(String raw) { return PUBLIC_SITE + "#" + route(raw); }
    public static String encode(String text) { try { return URLEncoder.encode(text, "UTF-8").replace("+", "%20"); } catch (java.io.UnsupportedEncodingException e) { throw new AssertionError(e); } }
    public static String walletBrowse(String wallet, String current) {
        String target = publicPage(current);
        return switch (wallet) {
            case "okx" -> "https://www.okx.com/download?deeplink=" + encode("okx://wallet/dapp/url?dappUrl=" + encode(target));
            case "metamask" -> "https://metamask.app.link/dapp/" + target.substring("https://".length()).replace("#", "%23");
            case "tronlink" -> "tronlinkoutside://pull.activity?param=" + encode("{\"url\":\"" + target + "\",\"action\":\"open\",\"protocol\":\"TronLink\",\"version\":\"1.0\"}");
            case "phantom" -> "https://phantom.app/ul/browse/" + encode(target) + "?ref=" + encode(PUBLIC_SITE);
            default -> throw new IllegalArgumentException("Unsupported wallet");
        };
    }
    /** Defense in depth: the local preview cannot submit exchange/broadcast requests. */
    public static boolean writeEndpoint(String raw) {
        URI u = parse(raw);
        if (u == null) return true;
        String p = String.valueOf(u.getPath()).toLowerCase(java.util.Locale.ROOT);
        return p.endsWith("/exchange") || p.contains("broadcasttransaction") || p.contains("broadcasthex");
    }
}
