package com.florian.financetracker;

import android.graphics.Color;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;
import io.capawesome.capacitorjs.plugins.filepicker.FilePickerPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(FilePickerPlugin.class);
        super.onCreate(savedInstanceState);
        getWindow().getDecorView().setBackgroundColor(Color.parseColor("#F5F0E8"));
        getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        WebView webView = getBridge().getWebView();
        webView.setBackgroundColor(Color.parseColor("#F5F0E8"));
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setJavaScriptEnabled(true);
    }
}