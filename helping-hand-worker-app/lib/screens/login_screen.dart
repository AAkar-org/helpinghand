import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';
import 'registration_screen.dart';
import 'home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _phoneController = TextEditingController();
  final _otpController = TextEditingController();
  final _apiService = ApiService();
  
  bool _otpSent = false;
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _phoneController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  Future<void> _sendOtp() async {
    final phone = _phoneController.text.trim();
    if (phone.isEmpty || phone.length < 10) {
      setState(() => _errorMessage = 'Please enter a valid 10-digit phone number');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await _apiService.sendOtp(phone);
      if (res['success'] == true) {
        setState(() => _otpSent = true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('OTP sent successfully (Use: ${res['otp'] ?? '123456'})'),
            backgroundColor: AppColors.statusGreen,
          ),
        );
      } else {
        setState(() => _errorMessage = res['error'] ?? 'Failed to send OTP');
      }
    } catch (e) {
      setState(() => _errorMessage = 'Server connection failed. Is the backend running?');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _verifyOtp() async {
    final phone = _phoneController.text.trim();
    final otp = _otpController.text.trim();
    if (otp.length != 6) {
      setState(() => _errorMessage = 'Please enter 6-digit OTP');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await _apiService.verifyOtp(phone, otp);
      if (res['success'] == true) {
        final isNewUser = res['isNewUser'] == true;
        if (isNewUser) {
          // Go to Onboarding/Registration
          if (mounted) {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(
                builder: (context) => RegistrationScreen(phoneNumber: phone),
              ),
            );
          }
        } else {
          // Login existing worker
          final userData = res['user'];
          await _apiService.saveSession(
            workerId: userData['worker_id'],
            phoneNumber: userData['phone_number'],
            category: userData['worker_category'],
            subCategory: userData['worker_sub_category'],
          );

          if (mounted) {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(builder: (context) => const HomeScreen()),
            );
          }
        }
      } else {
        setState(() => _errorMessage = res['error'] ?? 'Invalid OTP code');
      }
    } catch (e) {
      setState(() => _errorMessage = 'Verification error: ${e.toString()}');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [AppColors.primaryDark, AppColors.primaryMid],
            begin: Alignment.topCenter,
            end: Alignment.bottomCenter,
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 28.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(
                    Icons.handshake_outlined,
                    size: 80,
                    color: AppColors.accentPurple,
                  ),
                  const SizedBox(height: 24),
                  Text(
                    'Helping Hand 🤝',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.headlineLarge,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Verification and shift onboarding for workers',
                    textAlign: TextAlign.center,
                    style: theme.textTheme.bodyMedium?.copyWith(
                      color: AppColors.textDarkSecondary,
                    ),
                  ),
                  const SizedBox(height: 48),
                  if (_errorMessage != null) ...[
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: AppColors.statusRed.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: AppColors.statusRed.withOpacity(0.4)),
                      ),
                      child: Text(
                        _errorMessage!,
                        style: const TextStyle(color: Colors.white, fontSize: 13),
                        textAlign: TextAlign.center,
                      ),
                    ),
                    const SizedBox(height: 20),
                  ],
                  if (!_otpSent) ...[
                    TextField(
                      controller: _phoneController,
                      keyboardType: TextInputType.phone,
                      style: const TextStyle(color: Colors.white),
                      decoration: const InputDecoration(
                        labelText: 'Phone Number',
                        hintText: 'Enter your 10 digit number',
                        prefixIcon: Icon(Icons.phone, color: AppColors.textDarkSecondary),
                      ),
                    ),
                    const SizedBox(height: 20),
                    ElevatedButton(
                      onPressed: _isLoading ? null : _sendOtp,
                      child: _isLoading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                            )
                          : const Text('Send OTP'),
                    ),
                  ] else ...[
                    TextField(
                      controller: _otpController,
                      keyboardType: TextInputType.number,
                      maxLength: 6,
                      style: const TextStyle(color: Colors.white),
                      decoration: const InputDecoration(
                        labelText: 'Enter OTP Code',
                        hintText: '6-Digit verification code',
                        prefixIcon: Icon(Icons.lock_clock, color: AppColors.textDarkSecondary),
                        counterText: '',
                      ),
                    ),
                    const SizedBox(height: 20),
                    ElevatedButton(
                      onPressed: _isLoading ? null : _verifyOtp,
                      child: _isLoading
                          ? const SizedBox(
                              height: 20,
                              width: 20,
                              child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
                            )
                          : const Text('Verify & Proceed'),
                    ),
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: () => setState(() => _otpSent = false),
                      child: const Text(
                        'Change Phone Number',
                        style: TextStyle(color: AppColors.textDarkSecondary),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
