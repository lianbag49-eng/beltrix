package io.beltrix.android;

import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.nio.ByteBuffer;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;
import java.util.Base64;

/** Bounded, format-specific data only: never arbitrary paths, URLs or APK downloads. */
public final class ExportPolicy {
    public static final int LIMIT = 2 * 1024 * 1024;
    public static final int IMAGE_LIMIT = 5 * 1024 * 1024;
    private static final byte[] PNG = {(byte)137,80,78,71,13,10,26,10};
    private ExportPolicy() {}
    public static byte[] decode(String data, String mime) {
        if (data == null || data.length() > (LIMIT * 4 / 3 + 16)) throw new IllegalArgumentException("Export is too large");
        byte[] bytes;
        try { bytes = Base64.getDecoder().decode(data); } catch (IllegalArgumentException e) { throw new IllegalArgumentException("Invalid export encoding"); }
        if (bytes.length == 0 || bytes.length > LIMIT) throw new IllegalArgumentException("Invalid export size");
        if ("image/png".equals(mime)) {
            if (bytes.length < 24 || !Arrays.equals(PNG, Arrays.copyOf(bytes, 8))
                || !"IHDR".equals(new String(bytes,12,4,StandardCharsets.US_ASCII))) throw new IllegalArgumentException("Expected a PNG image");
            int width=ByteBuffer.wrap(bytes,16,4).getInt(), height=ByteBuffer.wrap(bytes,20,4).getInt();
            if(width<=0||height<=0||width>4096||height>4096)throw new IllegalArgumentException("PNG dimensions exceed the limit");
        } else if ("text/csv".equals(mime)) {
            try { StandardCharsets.UTF_8.newDecoder().decode(ByteBuffer.wrap(bytes)); }
            catch (Exception e) { throw new IllegalArgumentException("Expected UTF-8 CSV"); }
            for(byte b:bytes)if(b==0)throw new IllegalArgumentException("Binary CSV rejected");
        } else throw new IllegalArgumentException("Only PNG and CSV exports are supported");
        return bytes;
    }
    public static String filename(String name, String mime) {
        String extension="image/png".equals(mime)?".png":".csv";
        String clean=(name==null?"BELTRIX":name).replaceAll("[^A-Za-z0-9._-]","_").replaceFirst("^\\.+", "");
        if(clean.length()>80)clean=clean.substring(0,80);
        if(clean.trim().isEmpty())clean="BELTRIX";
        return clean.toLowerCase(java.util.Locale.ROOT).endsWith(extension)?clean:clean+extension;
    }
    public static byte[] boundedRead(InputStream input, int max) throws java.io.IOException {
        if(input==null)throw new java.io.IOException("Selected file is unavailable");
        ByteArrayOutputStream out=new ByteArrayOutputStream(); byte[] buffer=new byte[8192];int count;
        while((count=input.read(buffer))!=-1){if(out.size()+count>max)throw new java.io.IOException("Selected file is too large");out.write(buffer,0,count);}
        return out.toByteArray();
    }
    public static String imageMime(byte[] bytes) {
        if(bytes.length>=8&&Arrays.equals(PNG,Arrays.copyOf(bytes,8)))return "image/png";
        if(bytes.length>=3&&(bytes[0]&255)==255&&(bytes[1]&255)==216&&(bytes[2]&255)==255)return "image/jpeg";
        if(bytes.length>=12&&"RIFF".equals(new String(bytes,0,4,StandardCharsets.US_ASCII))&&"WEBP".equals(new String(bytes,8,4,StandardCharsets.US_ASCII)))return "image/webp";
        throw new IllegalArgumentException("Select a PNG, JPEG or WebP QR image");
    }
    public static String text(String value) {
        if(value==null||value.length()>8192||value.indexOf('\0')>=0)throw new IllegalArgumentException("Text is too long or invalid");
        if(value.chars().anyMatch(c->c>=0x202a&&c<=0x202e||c>=0x2066&&c<=0x2069))throw new IllegalArgumentException("Hidden text direction controls rejected");
        return value;
    }
}
