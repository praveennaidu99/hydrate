package com.praveeng.hydrate

import android.content.Context
import com.facebook.react.bridge.Promise
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

    @ReactMethod
    fun getPendingWidgetAdds(promise: Promise) {
        val context = reactApplicationContext
        val prefs = context.getSharedPreferences(HydrationWidgetProvider.PREFS_NAME, Context.MODE_PRIVATE)
        val addedMl = prefs.getInt("pendingAddedMl", 0)
        if (addedMl > 0) {
            prefs.edit().putInt("pendingAddedMl", 0).apply()
        }
        promise.resolve(addedMl)
    }
}
