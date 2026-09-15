import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';
import 'home_screen.dart';
import 'login_screen.dart';

class AuthSessionWrapper extends StatefulWidget {
  const AuthSessionWrapper({super.key});

  @override
  State<AuthSessionWrapper> createState() => _AuthSessionWrapperState();
}

class _AuthSessionWrapperState extends State<AuthSessionWrapper> {
  final ApiService _apiService = ApiService();
  bool _isChecking = true;
  bool _isLoggedIn = false;

  @override
  void initState() {
    super.initState();
    _checkAuthSession();
  }

  Future<void> _checkAuthSession() async {
    final loggedIn = await _apiService.isLoggedIn();
    if (!mounted) return;
    setState(() {
      _isLoggedIn = loggedIn;
      _isChecking = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_isChecking) {
      return const Scaffold(
        backgroundColor: AppColors.surfaceOffWhite,
        body: Center(
          child: CircularProgressIndicator(color: AppColors.primary),
        ),
      );
    }

    return _isLoggedIn ? const HomeScreen() : const EmployerLoginScreen();
  }
}
