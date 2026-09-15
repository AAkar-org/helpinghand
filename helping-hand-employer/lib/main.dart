import 'package:flutter/material.dart';
import 'screens/auth_session_wrapper.dart';
import 'theme/app_theme.dart';

void main() {
  runApp(const EmployerApp());
}

class EmployerApp extends StatelessWidget {
  const EmployerApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Helping Hand - Employer',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.lightTheme,
      themeMode: ThemeMode.light, // Defaulting to light mode for the dashboard aesthetic
      home: const AuthSessionWrapper(),
    );
  }
}
