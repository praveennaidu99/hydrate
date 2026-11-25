package com.praveeng.hydrate

import android.content.Context
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class HydrationWidgetModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    override fun getName(): String = "HydrationWidgetModule"

    @ReactMethod
    fun updateWidget(intakeMl: Double, goalMl: Double, unit: String) {
        val context = reactApplicationContext
        val prefs = context.getSharedPreferences(HydrationWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit()
            .putInt("intakeMl", intakeMl.toInt())
            .putInt("goalMl", goalMl.toInt())
            .putString("unit", unit)
            .apply()

        HydrationWidgetProvider.updateAll(context)
    }
}
