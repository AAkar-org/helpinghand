import 'package:flutter/material.dart';

class AppColors {
  // Theme main backgrounds
  static const Color primaryDark = Color(0xFF1B0B3A); // Deep dark purple/indigo
  static const Color primaryMid = Color(0xFF2C1654);  // Mid purple (cards on dark)
  static const Color primaryLight = Color(0xFF452C70); // Light purple (active tabs, borders)
  static const Color accentPurple = Color(0xFF6C3CE0); // Highlight CTAs, primary buttons
  
  // Surfaces
  static const Color surfaceWhite = Color(0xFFFFFFFF); // White cards
  static const Color surfaceOff = Color(0xFFF7F5FC);   // Off-white/gray background for content
  
  // Text Colors
  static const Color textLightPrimary = Color(0xFF1E1E2E); // Deep black/blue for white surface
  static const Color textLightSecondary = Color(0xFF6E6D8A); // Slate grey for subtitles
  static const Color textDarkPrimary = Color(0xFFFFFFFF); // White for dark surface
  static const Color textDarkSecondary = Color(0xFFB1A9C4); // Light purple-grey for subtitles
  
  // Feedback
  static const Color statusGreen = Color(0xFF10B981); // Available
  static const Color statusAmber = Color(0xFFF59E0B); // Pending / Warning
  static const Color statusRed = Color(0xFFEF4444);   // Urgent/Unavailable
}
