package com.praveeng.hydrate

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.LinearGradient
import android.graphics.Paint
import android.graphics.Path
import android.graphics.RadialGradient
import android.graphics.RectF
import android.graphics.Shader
import android.net.Uri
import android.widget.RemoteViews
import java.text.NumberFormat
import java.util.Locale

class HydrationWidgetProvider : AppWidgetProvider() {

    override fun onReceive(context: Context, intent: Intent) {
        super.onReceive(context, intent)
        if (intent.action == ACTION_QUICK_ADD) {
            val ml = intent.getIntExtra(EXTRA_ML, 250)
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val currentIntake = prefs.getInt("intakeMl", 0)
            val pendingAdds = prefs.getInt("pendingAddedMl", 0)

            val newIntake = currentIntake + ml
            prefs.edit()
                .putInt("intakeMl", newIntake)
                .putInt("pendingAddedMl", pendingAdds + ml)
                .apply()

            // Update all home screen widgets immediately in-place (DO NOT OPEN APP)
            updateAll(context)
        }
    }

    override fun onUpdate(context: Context, appWidgetManager: AppWidgetManager, appWidgetIds: IntArray) {
        for (appWidgetId in appWidgetIds) {
            updateAppWidget(context, appWidgetManager, appWidgetId)
        }
    }

    companion object {
        const val PREFS_NAME = "HydrationWidget"
        const val ACTION_QUICK_ADD = "com.praveeng.hydrate.ACTION_QUICK_ADD"
        const val EXTRA_ML = "extra_ml"

        fun updateAppWidget(context: Context, appWidgetManager: AppWidgetManager, appWidgetId: Int) {
            val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
            val intakeMl = prefs.getInt("intakeMl", 0)
            val goalMl = prefs.getInt("goalMl", 2500)
            val unit = prefs.getString("unit", "ml") ?: "ml"
            val remaining = Math.max(0, goalMl - intakeMl)

            val numberFormat = NumberFormat.getNumberInstance(Locale.US)
            val formattedIntake = numberFormat.format(intakeMl)
            val formattedGoal = numberFormat.format(goalMl)
            val formattedRemaining = numberFormat.format(remaining)

            val views = RemoteViews(context.packageName, R.layout.hydration_widget)

            // 1. Draw and set 3D Liquid Water Sphere Bitmap
            val sphereBitmap = drawSphereBitmap(context, intakeMl, goalMl)
            views.setImageViewBitmap(R.id.widget_sphere_image, sphereBitmap)

            // 2. Set metrics & dynamic status
            views.setTextViewText(R.id.widget_intake, formattedIntake)
            views.setTextViewText(R.id.widget_unit, unit)
            views.setTextViewText(R.id.widget_goal, "/ $formattedGoal")

            val statusText = if (intakeMl >= goalMl) {
                "Goal Reached Today! 🏆"
            } else {
                "$formattedRemaining $unit remaining"
            }
            views.setTextViewText(R.id.widget_status, statusText)

            val pct = if (goalMl > 0) Math.min(150, (intakeMl * 100 / goalMl)) else 0
            views.setTextViewText(R.id.widget_status_badge, if (pct >= 100) "Goal Met ✨" else "Daily Target")

            // 3. Header / info click -> opens the app (only when tapping info area)
            val openIntent = Intent(Intent.ACTION_VIEW, Uri.parse("hydrate://")).apply {
                flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            }
            val openPendingIntent = PendingIntent.getActivity(
                context, 0, openIntent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_info_container, openPendingIntent)
            views.setOnClickPendingIntent(R.id.widget_sphere_container, openPendingIntent)

            // 4. Quick-Add Buttons -> Broadcast ONLY (fills water in-place, DOES NOT OPEN APP!)
            val add250Intent = Intent(context, HydrationWidgetProvider::class.java).apply {
                action = ACTION_QUICK_ADD
                putExtra(EXTRA_ML, 250)
            }
            val add250Pending = PendingIntent.getBroadcast(
                context, 101, add250Intent,
                PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
            )
            views.setOnClickPendingIntent(R.id.widget_btn_250, add250Pending)

            val add500Intent = Intent(context, HydrationWidgetProvider::class.java).apply {
                action = ACTION_QUICK_ADD
                putExtra(EXTRA_ML, 500)
            }
            val add500Pending = PendingIntent.getBroadcast(
                context, 102, add500Intent,
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

        /**
         * Renders a 3D Glass Liquid Water Sphere with fluid wave curves,
         * specular highlight reflections, bubbles, and percentage label.
         */
        private fun drawSphereBitmap(context: Context, intakeMl: Int, goalMl: Int): Bitmap {
            val density = context.resources.displayMetrics.density
            val sizePx = (92 * density).toInt().coerceAtLeast(180)
            val bitmap = Bitmap.createBitmap(sizePx, sizePx, Bitmap.Config.ARGB_8888)
            val canvas = Canvas(bitmap)

            val cx = sizePx / 2f
            val cy = sizePx / 2f
            val radius = cx - (4f * density)

            // 1. Dark Oceanic Glass Sphere Background
            val bgPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                shader = RadialGradient(
                    cx, cy - (radius * 0.35f), radius * 1.25f,
                    Color.parseColor("#153857"),
                    Color.parseColor("#06111B"),
                    Shader.TileMode.CLAMP
                )
            }
            canvas.drawCircle(cx, cy, radius, bgPaint)

            // 2. Liquid Water Fill (Clipped to Circle)
            val ratio = if (goalMl > 0) (intakeMl.toFloat() / goalMl.toFloat()).coerceIn(0f, 1f) else 0f
            if (ratio > 0.01f) {
                val waterY = (cy + radius) - (radius * 2f * ratio)
                val clipPath = Path().apply {
                    addCircle(cx, cy, radius, Path.Direction.CW)
                }
                canvas.save()
                canvas.clipPath(clipPath)

                // Wave path across sphere
                val waveAmp = if (ratio in 0.05f..0.95f) 6.5f * density else 2f * density
                val waterPath = Path().apply {
                    moveTo(0f, sizePx.toFloat())
                    lineTo(0f, waterY)
                    quadTo(cx * 0.5f, waterY - waveAmp, cx, waterY)
                    quadTo(cx * 1.5f, waterY + waveAmp, sizePx.toFloat(), waterY)
                    lineTo(sizePx.toFloat(), sizePx.toFloat())
                    close()
                }

                val waterPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    shader = LinearGradient(
                        0f, waterY, 0f, sizePx.toFloat(),
                        Color.parseColor("#38BDF8"), // Vibrant Cyan surface
                        Color.parseColor("#1D4ED8"), // Royal Blue deep water
                        Shader.TileMode.CLAMP
                    )
                }
                canvas.drawPath(waterPath, waterPaint)

                // Wave crest surface line
                val waveLinePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = Color.parseColor("#BAE6FD")
                    style = Paint.Style.STROKE
                    strokeWidth = 2f * density
                }
                val waveLinePath = Path().apply {
                    moveTo(0f, waterY)
                    quadTo(cx * 0.5f, waterY - waveAmp, cx, waterY)
                    quadTo(cx * 1.5f, waterY + waveAmp, sizePx.toFloat(), waterY)
                }
                canvas.drawPath(waveLinePath, waveLinePaint)

                // Rising Bubbles
                val bubblePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                    color = Color.argb(130, 255, 255, 255)
                    style = Paint.Style.FILL
                }
                if (ratio > 0.2f) {
                    canvas.drawCircle(cx - 14f * density, (waterY + 16f * density).coerceAtMost(sizePx - 10f), 2.8f * density, bubblePaint)
                    canvas.drawCircle(cx + 16f * density, (waterY + 30f * density).coerceAtMost(sizePx - 10f), 4.2f * density, bubblePaint)
                    canvas.drawCircle(cx - 3f * density, (waterY + 44f * density).coerceAtMost(sizePx - 10f), 2.4f * density, bubblePaint)
                }

                canvas.restore()
            }

            // 3. 3D Glass Specular Reflection Highlight (top-left gleam)
            val highlightPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                shader = LinearGradient(
                    cx - radius * 0.6f, cy - radius * 0.8f,
                    cx, cy,
                    Color.argb(135, 255, 255, 255),
                    Color.argb(0, 255, 255, 255),
                    Shader.TileMode.CLAMP
                )
            }
            val highlightRect = RectF(
                cx - radius * 0.65f,
                cy - radius * 0.82f,
                cx + radius * 0.35f,
                cy - radius * 0.28f
            )
            canvas.drawOval(highlightRect, highlightPaint)

            // 4. Glass Rim Border & Cyan Glow
            val rimPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE
                strokeWidth = 2.2f * density
                color = Color.parseColor("#2B5E87")
            }
            canvas.drawCircle(cx, cy, radius, rimPaint)

            val glowPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                style = Paint.Style.STROKE
                strokeWidth = 1f * density
                color = Color.argb(90, 56, 189, 248)
            }
            canvas.drawCircle(cx, cy, radius + 1.2f * density, glowPaint)

            // 5. Centered High-Contrast Percentage Text with Dark Shadow
            val pct = (ratio * 100).toInt()
            val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
                color = Color.WHITE
                textSize = 18f * density
                isFakeBoldText = true
                textAlign = Paint.Align.CENTER
                setShadowLayer(6f * density, 0f, 2f * density, Color.parseColor("#D9000000"))
            }
            val fontMetrics = textPaint.fontMetrics
            val textY = cy - (fontMetrics.ascent + fontMetrics.descent) / 2f
            canvas.drawText("$pct%", cx, textY, textPaint)

            return bitmap
        }
    }
}
