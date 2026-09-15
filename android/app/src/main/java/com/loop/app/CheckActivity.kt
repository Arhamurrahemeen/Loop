package com.loop.app

import android.app.Activity
import android.content.ComponentName
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient

class CheckActivity : Activity() {
    private var filePathCallback: ValueCallback<Array<Uri>>? = null
    private lateinit var webView: WebView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WebView.setWebContentsDebuggingEnabled(true)
        webView = WebView(this)
        webView.settings.javaScriptEnabled = true
        webView.settings.mediaPlaybackRequiresUserGesture = false
        webView.webViewClient = object : WebViewClient() {
            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                super.onReceivedError(view, request, error)
                Log.e("Loop", "WebView load error: ${error?.description} for ${request?.url}")
            }
        }
        webView.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(
                view: WebView?,
                callback: ValueCallback<Array<Uri>>?,
                params: FileChooserParams?
            ): Boolean {
                filePathCallback?.onReceiveValue(null)
                filePathCallback = callback
                val acceptTypes = params?.acceptTypes?.filter { it.isNotBlank() } ?: emptyList()
                val mimeType = acceptTypes.firstOrNull() ?: "*/*"
                val intent = Intent(Intent.ACTION_GET_CONTENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = mimeType
                }
                startActivityForResult(Intent.createChooser(intent, "Select file"), FILE_CHOOSER_REQUEST)
                return true
            }
        }
        webView.addJavascriptInterface(BrowserBridge(), "Android")
        setContentView(webView)
        loadForIntent(intent)
    }

    private inner class BrowserBridge {
        @JavascriptInterface
        fun openInBrowser(url: String) {
            runOnUiThread {
                val chromeIntent = Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                    setPackage("com.android.chrome")
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
                try {
                    startActivity(chromeIntent)
                } catch (e: Exception) {
                    // Chrome isn't installed — fall back to any other browser, explicitly excluding ourselves
                    // (we're the default handler, so an unqualified VIEW intent would just loop back to us).
                    val plain = Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    val chooser = Intent.createChooser(plain, "Open with").apply {
                        putExtra(Intent.EXTRA_EXCLUDE_COMPONENTS, arrayOf(ComponentName(this@CheckActivity, CheckActivity::class.java)))
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                    }
                    startActivity(chooser)
                }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        loadForIntent(intent)
    }

    private fun loadForIntent(intent: Intent) {
        val viewedUri = if (intent.action == Intent.ACTION_VIEW) intent.data else null
        val mode = intent.getStringExtra(EXTRA_MODE)
        val url = when {
            viewedUri != null -> "$SERVER_URL/?check=" + Uri.encode(viewedUri.toString())
            mode == "verify" -> "$SERVER_URL/?verify=1"
            else -> SERVER_URL
        }
        webView.loadUrl(url)
    }

    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (requestCode == FILE_CHOOSER_REQUEST) {
            val uri = if (resultCode == RESULT_OK) data?.data else null
            filePathCallback?.onReceiveValue(if (uri != null) arrayOf(uri) else null)
            filePathCallback = null
        } else {
            super.onActivityResult(requestCode, resultCode, data)
        }
    }

    companion object {
        // ponytail: hardcoded to the demo laptop's LAN IP — update here if the network changes.
        const val SERVER_URL = "http://10.25.0.132:3000"
        const val FILE_CHOOSER_REQUEST = 51426
        const val EXTRA_MODE = "mode"
    }
}
