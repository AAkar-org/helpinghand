import 'package:flutter/material.dart';
import 'app_colors.dart';

class AppTheme {
  static ThemeData get darkTheme {
    return ThemeData.dark().copyWith(
      scaffoldBackgroundColor: AppColors.primaryDark,
      primaryColor: AppColors.accentPurple,
      colorScheme: const ColorScheme.dark(
        primary: AppColors.accentPurple,
        secondary: AppColors.primaryLight,
        surface: AppColors.primaryMid,
        background: AppColors.primaryDark,
        onPrimary: Colors.white,
        onSecondary: Colors.white,
        onSurface: AppColors.textDarkPrimary,
        onBackground: AppColors.textDarkPrimary,
      ),
      textTheme: const TextTheme(
        headlineLarge: TextStyle(
          fontSize: 28,
          fontWeight: FontWeight.bold,
          color: AppColors.textDarkPrimary,
          letterSpacing: -0.5,
        ),
        headlineMedium: TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.bold,
          color: AppColors.textDarkPrimary,
        ),
        titleMedium: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          color: AppColors.textDarkPrimary,
        ),
        bodyLarge: TextStyle(
          fontSize: 15,
          color: AppColors.textDarkPrimary,
        ),
        bodyMedium: TextStyle(
          fontSize: 13,
          color: AppColors.textDarkSecondary,
        ),
      ),
      cardTheme: const CardTheme(
        color: AppColors.primaryMid,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(16)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: AppColors.primaryLight.withOpacity(0.4),
        hintStyle: const TextStyle(color: AppColors.textDarkSecondary, fontSize: 14),
        labelStyle: const TextStyle(color: AppColors.textDarkPrimary, fontSize: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: AppColors.primaryLight.withOpacity(0.5), width: 1.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.accentPurple, width: 2),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.accentPurple,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }

  static ThemeData get lightTheme {
    return ThemeData.light().copyWith(
      scaffoldBackgroundColor: AppColors.surfaceOff,
      primaryColor: AppColors.accentPurple,
      colorScheme: const ColorScheme.light(
        primary: AppColors.accentPurple,
        secondary: AppColors.primaryMid,
        surface: AppColors.surfaceWhite,
        background: AppColors.surfaceOff,
        onPrimary: Colors.white,
        onSecondary: Colors.white,
        onSurface: AppColors.textLightPrimary,
        onBackground: AppColors.textLightPrimary,
      ),
      textTheme: const TextTheme(
        headlineLarge: TextStyle(
          fontSize: 28,
          fontWeight: FontWeight.bold,
          color: AppColors.textLightPrimary,
          letterSpacing: -0.5,
        ),
        headlineMedium: TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.bold,
          color: AppColors.textLightPrimary,
        ),
        titleMedium: TextStyle(
          fontSize: 16,
          fontWeight: FontWeight.w600,
          color: AppColors.textLightPrimary,
        ),
        bodyLarge: TextStyle(
          fontSize: 15,
          color: AppColors.textLightPrimary,
        ),
        bodyMedium: TextStyle(
          fontSize: 13,
          color: AppColors.textLightSecondary,
        ),
      ),
      cardTheme: const CardTheme(
        color: AppColors.surfaceWhite,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.all(Radius.circular(16)),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        hintStyle: const TextStyle(color: AppColors.textLightSecondary, fontSize: 14),
        labelStyle: const TextStyle(color: AppColors.textLightPrimary, fontSize: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.grey.shade200),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: BorderSide(color: Colors.grey.shade200, width: 1.5),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: AppColors.accentPurple, width: 2),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.accentPurple,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 24),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
      ),
    );
  }
}
