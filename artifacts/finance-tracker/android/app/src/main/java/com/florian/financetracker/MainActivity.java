package com.florian.financetracker;

import android.graphics.Color;
import android.os.Bundle;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;
import io.capawesome.capacitorjs.plugins.filepicker.FilePickerPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(FilePickerPlugin.class);
        super.onCreate(savedInstanceState);

        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        getWindow().setNavigationBarColor(Color.parseColor("#CAFA01"));
        getWindow().setStatusBarColor(Color.parseColor("#CAFA01"));

        getWindow().getDecorView().setBackgroundColor(Color.parseColor("#CAFA01"));
        WebView webView = getBridge().getWebView();
        webView.setBackgroundColor(Color.parseColor("#CAFA01"));
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setJavaScriptEnabled(true);
        webView.getSettings().setTextZoom(100);

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> {
                    for (String r : request.getResources()) {
                        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r)) {
                            request.grant(new String[]{ PermissionRequest.RESOURCE_AUDIO_CAPTURE });
                            return;
                        }
                    }
                    request.deny();
                });
            }
        });
    }
}
