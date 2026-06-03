package com.florian.financetracker;

import android.graphics.Color;
import android.os.Bundle;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().setBackgroundDrawableResource(android.R.color.transparent);
        WebView webView = getBridge().getWebView();
        getWindow().getDecorView().setBackgroundColor(Color.parseColor("#F5F0E8"));
        webView.setBackgroundColor(Color.parseColor("#F5F0E8"));
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setJavaScriptEnabled(true);
    }
}