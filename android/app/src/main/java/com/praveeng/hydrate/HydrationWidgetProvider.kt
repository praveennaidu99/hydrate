package com.praveeng.hydrate

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.widget.RemoteViews
import java.text.NumberFormat
import java.util.Locale

class HydrationWidgetProvider : AppWidgetProvider() {

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    companion object {
        const val PREFS_NAME = "HydrationWidget"

        fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val intakeMl = prefs.getInt("intakeMl", 0)
            val goalMl = prefs.getInt("goalMl", 2500)
            val unit = prefs.getString("unit", "ml") ?: "ml"
            val pct = if (goalMl > 0) Math.min(150, (intakeMl * 100 / goalMl)) else 0
            val remaining = Math.max(0, goalMl - intakeMl)

            val numberFormat = NumberFormat.getNumberInstance(Locale.US)
            val formattedIntake = numberFormat.format(intakeMl)
            val formattedGoal = numberFormat.format(goalMl)
            val formattedRemaining = numberFormat.format(remaining)

            val views = RemoteViews(context.packageName, R.layout.hydration_widget)

            // Update text & progress
            views.setTextViewText(R.id.widget_pct, if (pct >= 100) "$pct% ✨" else "$pct%")
            views.setTextViewText(R.id.widget_intake, formattedIntake)
            views.setTextViewText(R.id.widget_unit, unit)

            val statusText = if (intakeMl >= goalMl) {
                "Goal Reached! 🏆"
            } else {
                "$formattedRemaining $unit to $formattedGoal goal"
            }
            views.setTextViewText(R.id.widget_status, statusText)
            views.setProgressBar(R.id.widget_progress, 100, Math.min(100, pct), false)

            // Open app on root click
            val openIntent = Intent(Intent.ACTION_VIEW, Uri.parse("hydrate://")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val openPendingIntent = PendingIntent.getActivity(
                context, 0, openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_root, openPendingIntent)

            // Quick add +250ml
            val add250Intent = Intent(Intent.ACTION_VIEW, Uri.parse("hydrate://quick-add?ml=250")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val add250Pending = PendingIntent.getActivity(
                context, 1, add250Intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_btn_250, add250Pending)

            // Quick add +500ml
            val add500Intent = Intent(Intent.ACTION_VIEW, Uri.parse("hydrate://quick-add?ml=500")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val add500Pending = PendingIntent.getActivity(
                context, 2, add500Intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_btn_500, add500Pending)

            appWidgetManager.updateAppWidget(appWidgetId, views)
        }

        fun updateAll(context: Context) {
            val appWidgetManager = AppWidgetManager.getInstance(context)
            val ids = appWidgetManager.getAppWidgetIds(ComponentName(context, HydrationWidgetProvider::class.java))
            for (id in ids) {
                updateAppWidget(context, appWidgetManager, id)
            }
        }
    }
}
