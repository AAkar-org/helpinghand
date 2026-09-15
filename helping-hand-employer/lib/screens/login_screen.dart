import 'dart:async';
import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';
import 'home_screen.dart';
import 'registration_screen.dart';

class EmployerLoginScreen extends StatefulWidget {
  const EmployerLoginScreen({super.key});

  @override
  State<EmployerLoginScreen> createState() => _EmployerLoginScreenState();
}

class _EmployerLoginScreenState extends State<EmployerLoginScreen> {
  final ApiService _apiService = ApiService();
  final TextEditingController _phoneController = TextEditingController();
  final List<TextEditingController> _otpControllers = List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _otpFocusNodes = List.generate(6, (_) => FocusNode());

  bool _otpSent = false;
  bool _isLoading = false;
  int _cooldownSeconds = 0;
  Timer? _cooldownTimer;
  String? _errorMessage;
  String? _devOtp;

  @override
  void dispose() {
    _cooldownTimer?.cancel();
    _phoneController.dispose();
    for (var c in _otpControllers) {
      c.dispose();
    }
    for (var f in _otpFocusNodes) {
      f.dispose();
    }
    super.dispose();
  }

  void _startCooldown() {
    setState(() => _cooldownSeconds = 60);
    _cooldownTimer?.cancel();
    _cooldownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted) return;
      if (_cooldownSeconds > 0) {
        setState(() => _cooldownSeconds--);
      } else {
        timer.cancel();
      }
    });
  }

  Future<void> _handleSendOtp() async {
    final phone = _phoneController.text.trim();
    if (phone.length < 10) {
      setState(() => _errorMessage = 'Please enter a valid 10-digit mobile number');
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final res = await _apiService.sendOtp(phone);
      if (res['success'] == true) {
        setState(() {
          _otpSent = true;
          _devOtp = res['otp'];
        });
        _startCooldown();
        if (_devOtp != null && mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text('Development OTP: $_devOtp (or use bypass: 123456)'),
              backgroundColor: AppColors.primary,
              duration: const Duration(seconds: 5),
            ),
          );
        }
      } else {
        setState(() => _errorMessage = res['error'] ?? 'Failed to send OTP. Please try again.');
      }
    } catch (e) {
      setState(() => _errorMessage = 'Connection error: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleVerifyOtp() async {
    final phone = _phoneController.text.trim();
    final otp = _otpControllers.map((c) => c.text.trim()).join();

    if (otp.length != 6) {
      setState(() => _errorMessage = 'Please enter all 6 digits of the OTP code');
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
          if (!mounted) return;
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(
              builder: (context) => EmployerRegistrationScreen(phoneNumber: phone),
            ),
          );
        } else {
          final user = res['user'];
          await _apiService.saveSession(
            employerId: user['employer_id'],
            phoneNumber: user['phone_number'],
            fullName: user['full_name'],
            email: user['email'],
            avatarUrl: user['avatar_url'],
            upiId: user['upi_id'],
            token: res['token'],
            refreshToken: res['refreshToken'],
          );

          if (!mounted) return;
          Navigator.pushReplacement(
            context,
            MaterialPageRoute(builder: (context) => const HomeScreen()),
          );
        }
      } else {
        setState(() => _errorMessage = res['error'] ?? 'Invalid OTP code. Please try again.');
      }
    } catch (e) {
      setState(() => _errorMessage = 'Verification error: $e');
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _showGoogleSignInModal() async {
    final emailController = TextEditingController(text: 'rajesh.builder@gmail.com');
    final nameController = TextEditingController(text: 'Rajesh Construction');

    await showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(bottom: MediaQuery.of(ctx).viewInsets.bottom),
        child: Container(
          decoration: const BoxDecoration(
            color: AppColors.surfaceWhite,
            borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
          ),
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: AppColors.primaryLight,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: const Icon(Icons.account_circle, color: AppColors.primary, size: 28),
                  ),
                  const SizedBox(width: 16),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Google Authentication',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary),
                        ),
                        Text(
                          'Select or enter Google identity',
                          style: TextStyle(fontSize: 13, color: AppColors.textSecondary),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              TextField(
                controller: emailController,
                keyboardType: TextInputType.emailAddress,
                decoration: InputDecoration(
                  labelText: 'Google Email',
                  prefixIcon: const Icon(Icons.email_outlined),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: nameController,
                decoration: InputDecoration(
                  labelText: 'Account / Business Name',
                  prefixIcon: const Icon(Icons.business_outlined),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () async {
                  Navigator.pop(ctx);
                  final email = emailController.text.trim();
                  final name = nameController.text.trim();
                  if (email.isEmpty) return;

                  setState(() {
                    _isLoading = true;
                    _errorMessage = null;
                  });

                  try {
                    final idToken = 'mock-google-token:$email:$name:google-emp-${DateTime.now().millisecondsSinceEpoch}';
                    final res = await _apiService.googleAuth(idToken: idToken, role: 'employer');

                    if (res['success'] == true) {
                      final user = res['user'];
                      await _apiService.saveSession(
                        employerId: user['employer_id'],
                        phoneNumber: user['phone_number'],
                        fullName: user['full_name'],
                        email: user['email'],
                        avatarUrl: user['avatar_url'],
                        upiId: user['upi_id'],
                        token: res['token'],
                        refreshToken: res['refreshToken'],
                      );

                      if (!mounted) return;
                      Navigator.pushReplacement(
                        context,
                        MaterialPageRoute(builder: (context) => const HomeScreen()),
                      );
                    } else {
                      setState(() => _errorMessage = res['error'] ?? 'Google sign-in failed');
                    }
                  } catch (e) {
                    setState(() => _errorMessage = 'Google auth error: $e');
                  } finally {
                    if (mounted) setState(() => _isLoading = false);
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: const Text('Confirm & Sign In', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfaceOffWhite,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 32.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 20),
              // Brand Icon
              Center(
                child: Container(
                  width: 72,
                  height: 72,
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(20),
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.primary.withValues(alpha: 0.3),
                        blurRadius: 16,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: const Center(
                    child: Icon(Icons.handshake_rounded, color: Colors.white, size: 40),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              // Header
              const Text(
                'Helping Hand',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.bold,
                  color: AppColors.textPrimary,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Employer Portal • Verified Labor On-Demand',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: AppColors.textSecondary,
                ),
              ),
              const SizedBox(height: 40),

              // Card Container
              Container(
                decoration: BoxDecoration(
                  color: AppColors.surfaceWhite,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: AppColors.borderLight),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.04),
                      blurRadius: 16,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      _otpSent ? 'Enter 6-Digit Code' : 'Sign in with Phone',
                      style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: AppColors.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      _otpSent
                          ? 'Enter the verification code sent to +91 ${_phoneController.text.trim()}'
                          : 'Enter your phone number to receive a verification code',
                      style: const TextStyle(fontSize: 13, color: AppColors.textSecondary),
                    ),
                    const SizedBox(height: 20),

                    if (_errorMessage != null)
                      Container(
                        padding: const EdgeInsets.all(12),
                        margin: const EdgeInsets.only(bottom: 16),
                        decoration: BoxDecoration(
                          color: AppColors.statusRedLight,
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: AppColors.statusRed.withValues(alpha: 0.3)),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.error_outline, color: AppColors.statusRed, size: 20),
                            const SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                _errorMessage!,
                                style: const TextStyle(color: AppColors.statusRed, fontSize: 13),
                              ),
                            ),
                          ],
                        ),
                      ),

                    if (!_otpSent) ...[
                      TextField(
                        controller: _phoneController,
                        keyboardType: TextInputType.phone,
                        maxLength: 10,
                        decoration: InputDecoration(
                          prefixIcon: const Padding(
                            padding: EdgeInsets.symmetric(horizontal: 14, vertical: 14),
                            child: Text('+91', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                          ),
                          hintText: 'Enter 10-digit mobile number',
                          counterText: '',
                          border: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(color: AppColors.borderLight),
                          ),
                          focusedBorder: OutlineInputBorder(
                            borderRadius: BorderRadius.circular(12),
                            borderSide: const BorderSide(color: AppColors.primary, width: 2),
                          ),
                        ),
                      ),
                      const SizedBox(height: 20),
                      ElevatedButton(
                        onPressed: _isLoading ? null : _handleSendOtp,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          elevation: 0,
                        ),
                        child: _isLoading
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Text('Get OTP', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      ),
                    ] else ...[
                      // 6-digit OTP fields
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: List.generate(6, (index) {
                          return SizedBox(
                            width: 44,
                            height: 52,
                            child: TextField(
                              controller: _otpControllers[index],
                              focusNode: _otpFocusNodes[index],
                              keyboardType: TextInputType.number,
                              textAlign: TextAlign.center,
                              maxLength: 1,
                              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold),
                              decoration: InputDecoration(
                                counterText: '',
                                contentPadding: EdgeInsets.zero,
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  borderSide: const BorderSide(color: AppColors.borderLight),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(10),
                                  borderSide: const BorderSide(color: AppColors.primary, width: 2),
                                ),
                              ),
                              onChanged: (val) {
                                if (val.isNotEmpty && index < 5) {
                                  _otpFocusNodes[index + 1].requestFocus();
                                } else if (val.isEmpty && index > 0) {
                                  _otpFocusNodes[index - 1].requestFocus();
                                }
                                if (_otpControllers.every((c) => c.text.isNotEmpty)) {
                                  _handleVerifyOtp();
                                }
                              },
                            ),
                          );
                        }),
                      ),
                      const SizedBox(height: 20),
                      ElevatedButton(
                        onPressed: _isLoading ? null : _handleVerifyOtp,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: AppColors.primary,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(vertical: 16),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                          elevation: 0,
                        ),
                        child: _isLoading
                            ? const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                              )
                            : const Text('Verify & Continue', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                      ),
                      const SizedBox(height: 14),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          TextButton(
                            onPressed: () {
                              setState(() {
                                _otpSent = false;
                                for (var c in _otpControllers) {
                                  c.clear();
                                }
                              });
                            },
                            child: const Text('Change Number', style: TextStyle(color: AppColors.textSecondary)),
                          ),
                          TextButton(
                            onPressed: _cooldownSeconds > 0 ? null : _handleSendOtp,
                            child: Text(
                              _cooldownSeconds > 0 ? 'Resend in ${_cooldownSeconds}s' : 'Resend OTP',
                              style: TextStyle(
                                color: _cooldownSeconds > 0 ? AppColors.textSecondary : AppColors.primary,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),

              const SizedBox(height: 24),
              // Divider
              Row(
                children: [
                  const Expanded(child: Divider(color: AppColors.borderLight)),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Text(
                      'OR',
                      style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textSecondary.withValues(alpha: 0.7)),
                    ),
                  ),
                  const Expanded(child: Divider(color: AppColors.borderLight)),
                ],
              ),
              const SizedBox(height: 24),

              // Google Sign-In Button
              OutlinedButton(
                onPressed: _isLoading ? null : _showGoogleSignInModal,
                style: OutlinedButton.styleFrom(
                  backgroundColor: AppColors.surfaceWhite,
                  side: const BorderSide(color: AppColors.borderLight),
                  padding: const EdgeInsets.symmetric(vertical: 15),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Image.network(
                      'https://www.gstatic.com/images/branding/product/2x/googleg_48dp.png',
                      width: 22,
                      height: 22,
                      errorBuilder: (_, __, ___) => const Icon(Icons.g_mobiledata, color: AppColors.primary, size: 28),
                    ),
                    const SizedBox(width: 12),
                    const Text(
                      'Continue with Google',
                      style: TextStyle(
                        color: AppColors.textPrimary,
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 32),
              const Center(
                child: Text(
                  'By continuing, you agree to Helping Hand Terms of Service & Privacy Policy',
                  textAlign: TextAlign.center,
                  style: TextStyle(fontSize: 11, color: AppColors.textSecondary),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
