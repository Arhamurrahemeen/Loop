package com.loop.app

import android.app.Activity
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Bundle
import android.provider.Settings
import android.view.Gravity
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class MainActivity : Activity() {
    private lateinit var statusText: TextView

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            gravity = Gravity.CENTER
            setPadding(64, 64, 64, 64)
            setBackgroundColor(Color.parseColor("#0f172a"))
        }

        val title = TextView(this).apply {
            text = "🛡️ Loop"
            textSize = 28f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER
        }

        statusText = TextView(this).apply {
            textSize = 16f
            setTextColor(Color.parseColor("#94a3b8"))
            gravity = Gravity.CENTER
            setPadding(0, 32, 0, 48)
        }

        val startBtn = Button(this).apply {
            text = "Start floating shield"
            setOnClickListener { requestOverlayThenStart() }
        }

        val stopBtn = Button(this).apply {
            text = "Stop floating shield"
            setOnClickListener { stopService(Intent(this@MainActivity, BubbleService::class.java)) }
        }

        root.addView(title)
        root.addView(statusText)
        root.addView(startBtn)
        root.addView(stopBtn)
        setContentView(root)
    }

    override fun onResume() {
        super.onResume()
        updateStatus()
        if (Settings.canDrawOverlays(this)) {
            startService(Intent(this, BubbleService::class.java))
        }
    }

    private fun updateStatus() {
        statusText.text = if (Settings.canDrawOverlays(this))
            "Permission granted. The shield bubble is running — drag it anywhere, tap it to check something."
        else
            "Needs permission to draw over other apps. Tap Start."
    }

    private fun requestOverlayThenStart() {
        if (!Settings.canDrawOverlays(this)) {
            startActivity(Intent(Settings.ACTION_MANAGE_OVERLAY_PERMISSION, Uri.parse("package:$packageName")))
        } else {
            startService(Intent(this, BubbleService::class.java))
        }
    }
}
