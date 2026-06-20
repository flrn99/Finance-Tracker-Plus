package com.florian.financetracker;
import android.graphics.Color;
import android.os.Bundle;
import android.webkit.WebView;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;
import io.capawesome.capacitorjs.plugins.filepicker.FilePickerPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        registerPlugin(FilePickerPlugin.class);
        super.onCreate(savedInstanceState);

        // Que la WebView ocupe toda la pantalla incluyendo nav bar y status bar
        WindowCompat.setDecorFitsSystemWindows(getWindow(), false);

        // Nav bar y status bar transparentes — la WebView controla el color desde JS
        getWindow().setNavigationBarColor(Color.TRANSPARENT);
        getWindow().setStatusBarColor(Color.TRANSPARENT);

        getWindow().getDecorView().setBackgroundColor(Color.parseColor("#A8FF3E"));
        WebView webView = getBridge().getWebView();
        webView.setBackgroundColor(Color.parseColor("#A8FF3E"));
        webView.getSettings().setDomStorageEnabled(true);
        webView.getSettings().setJavaScriptEnabled(true);
    }
}
