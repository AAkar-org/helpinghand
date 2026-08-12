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

  bool _showGetStarted = true;
  bool _otpSent = false;
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _phoneController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  bool get _isPhoneValid {
    final phone = _phoneController.text.trim();
    return phone.length == 10 && RegExp(r'^[0-9]+$').hasMatch(phone);
  }

  bool get _isOtpValid {
    final otp = _otpController.text.trim();
    return otp.length == 6 && RegExp(r'^[0-9]+$').hasMatch(otp);
  }

  Future<void> _sendOtp() async {
    final phone = _phoneController.text.trim();
    if (!_isPhoneValid) {
      setState(
        () => _errorMessage = 'Please enter a valid 10-digit phone number.',
      );
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
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                'OTP sent successfully (Use: ${res['otp'] ?? '123456'})',
              ),
              backgroundColor: AppColors.statusGreen,
            ),
          );
        }
      } else {
        final error = res['error']?.toString() ?? '';
        String errMsg = 'Something went wrong. Please try again.';
        if (error.contains('limit') || error.contains('too many')) {
          errMsg = 'Too many attempts. Please try again later.';
        } else if (error.isNotEmpty) {
          errMsg = error;
        }
        setState(() => _errorMessage = errMsg);
      }
    } catch (e) {
      setState(
        () => _errorMessage =
            'Couldn\'t send the OTP. Please check your connection and try again.',
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _verifyOtp() async {
    final phone = _phoneController.text.trim();
    final otp = _otpController.text.trim();
    if (!_isOtpValid) {
      setState(() => _errorMessage = 'Please enter a valid 6-digit OTP.');
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
          if (mounted) {
            Navigator.pushReplacement(
              context,
              MaterialPageRoute(
                builder: (context) => RegistrationScreen(phoneNumber: phone),
              ),
            );
          }
        } else {
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
        setState(
          () => _errorMessage =
              res['error'] ?? 'Invalid OTP code. Please try again.',
        );
      }
    } catch (e) {
      setState(() => _errorMessage = 'Something went wrong. Please try again.');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  // 1. Onboarding / Get Started Screen
  Widget _buildOnboarding() {
    return Scaffold(
      body: Stack(
        children: [
          // Background image
          Positioned.fill(
            child: Image.asset(
              'assets/images/worker_onboarding.jpg',
              fit: BoxFit.cover,
              alignment: Alignment.topCenter,
            ),
          ),
          // Dark gradient overlay
          Positioned.fill(
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Colors.black.withOpacity(0.1),
                    Colors.black.withOpacity(0.55),
                    Colors.black.withOpacity(0.92),
                  ],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  stops: const [0.0, 0.45, 0.85],
                ),
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.symmetric(
                horizontal: 28.0,
                vertical: 24.0,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Spacer(),

                  // Heading
                  const Text(
                    'Smart Work\nMade Simple',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 38,
                      fontWeight: FontWeight.bold,
                      height: 1.1,
                    ),
                  ),
                  const SizedBox(height: 12),
                  // Subtitle
                  Text(
                    'Find verified local daily labor shifts and receive secure cash payouts at 5 PM daily.',
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.7),
                      fontSize: 14,
                      height: 1.4,
                    ),
                  ),
                  const SizedBox(height: 40),
                  // Custom Premium Get Started Button
                  InkWell(
                    onTap: () {
                      setState(() => _showGetStarted = false);
                    },
                    borderRadius: BorderRadius.circular(30),
                    child: Container(
                      height: 60,
                      decoration: BoxDecoration(
                        color: Colors.white.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(30),
                        border: Border.all(color: Colors.white24, width: 1),
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 6),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Container(
                            width: 48,
                            height: 48,
                            decoration: const BoxDecoration(
                              color: AppColors.accentPurple,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.handshake,
                              color: Colors.white,
                              size: 20,
                            ),
                          ),
                          const Text(
                            'Get Started',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                          const Padding(
                            padding: EdgeInsets.only(right: 16.0),
                            child: Icon(
                              Icons.keyboard_double_arrow_right,
                              color: Colors.white54,
                              size: 20,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: 16),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // 2. White & Purple Login Screen (Wavy Header)
  Widget _buildLoginScreen() {
    return Scaffold(
      backgroundColor: Colors.white,
      body: LayoutBuilder(
        builder: (context, constraints) {
          return SingleChildScrollView(
            keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
            child: ConstrainedBox(
              constraints: BoxConstraints(minHeight: constraints.maxHeight),
              child: IntrinsicHeight(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    // Curved Dark Purple Header Banner
                    ClipPath(
                      clipper: WavyHeaderClipper(),
                      child: Container(
                        height: 350,
                        decoration: const BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              AppColors.primaryDark,
                              AppColors.primaryMid,
                            ],
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                          ),
                        ),
                        child: const SafeArea(
                          bottom: false,
                          child: Center(child: HelpingHandLogoHeader()),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),

                    // Main Form Content (Clean White Section)
                    Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 24.0,
                        vertical: 10.0,
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          // Custom Typography Header
                          const Text(
                            'Verify your phone number',
                            style: TextStyle(
                              color: AppColors.textLightPrimary,
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                            ),
                            textAlign: TextAlign.left,
                          ),
                          const SizedBox(height: 6),
                          Text(
                            _otpSent
                                ? 'Enter the 6-digit verification code sent to +91 ${_phoneController.text.trim()}.'
                                : 'Enter your phone number to securely continue.',
                            style: const TextStyle(
                              color: AppColors.textLightSecondary,
                              fontSize: 14,
                            ),
                            textAlign: TextAlign.left,
                          ),
                          const SizedBox(height: 36),

                          // Input Form & Actions
                          if (!_otpSent) ...[
                            PhoneNumberFieldLight(
                              controller: _phoneController,
                              errorText: _errorMessage,
                              onChanged: (val) {
                                if (_errorMessage != null) {
                                  setState(() => _errorMessage = null);
                                }
                                setState(() {}); // Rebuild button status
                              },
                            ),
                            const SizedBox(height: 24),
                            PrimaryButton(
                              text: 'Send OTP',
                              isLoading: _isLoading,
                              onPressed: _isPhoneValid ? _sendOtp : null,
                            ),
                          ] else ...[
                            OtpCodeFieldLight(
                              controller: _otpController,
                              errorText: _errorMessage,
                              onChanged: (val) {
                                if (_errorMessage != null) {
                                  setState(() => _errorMessage = null);
                                }
                                setState(() {});
                              },
                            ),
                            const SizedBox(height: 24),
                            PrimaryButton(
                              text: 'Verify & Proceed',
                              isLoading: _isLoading,
                              onPressed: _isOtpValid ? _verifyOtp : null,
                            ),
                            const SizedBox(height: 16),
                            TextButton(
                              onPressed: () {
                                setState(() {
                                  _otpSent = false;
                                  _otpController.clear();
                                  _errorMessage = null;
                                });
                              },
                              child: const Text(
                                'Change Phone Number',
                                style: TextStyle(
                                  color: AppColors.accentPurple,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),

                    const Spacer(),
                    const SizedBox(height: 32),
                    // Security Disclaimer & Links
                    const SafeArea(
                      top: false,
                      bottom: true,
                      child: Padding(
                        padding: EdgeInsets.symmetric(horizontal: 24.0),
                        child: SecurityFooterLight(),
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedSwitcher(
      duration: const Duration(milliseconds: 320),
      transitionBuilder: (child, animation) {
        return FadeTransition(opacity: animation, child: child);
      },
      child: _showGetStarted
          ? KeyedSubtree(
              key: const ValueKey('onboarding'),
              child: _buildOnboarding(),
            )
          : KeyedSubtree(
              key: const ValueKey('login'),
              child: _buildLoginScreen(),
            ),
    );
  }
}

// Custom Clipper representing the curved wavy design
class WavyHeaderClipper extends CustomClipper<Path> {
  @override
  Path getClip(Size size) {
    final path = Path();
    path.lineTo(0, size.height - 45);

    final controlPoint1 = Offset(size.width * 0.35, size.height - 65);
    final endPoint1 = Offset(size.width * 0.7, size.height - 25);
    path.quadraticBezierTo(
      controlPoint1.dx,
      controlPoint1.dy,
      endPoint1.dx,
      endPoint1.dy,
    );

    final controlPoint2 = Offset(size.width * 0.86, size.height + 5);
    final endPoint2 = Offset(size.width, size.height - 15);
    path.quadraticBezierTo(
      controlPoint2.dx,
      controlPoint2.dy,
      endPoint2.dx,
      endPoint2.dy,
    );

    path.lineTo(size.width, 0);
    path.close();
    return path;
  }

  @override
  bool shouldReclip(CustomClipper<Path> oldClipper) => false;
}

// Logo Header components inside the Wavy Banner
class HelpingHandLogoHeader extends StatelessWidget {
  const HelpingHandLogoHeader({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.all(10),
          decoration: BoxDecoration(
            color: Colors.white.withOpacity(0.12),
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white30, width: 1),
          ),
          child: const Icon(
            Icons.handshake_outlined,
            size: 38,
            color: Colors.white,
          ),
        ),
        const SizedBox(height: 10),
        const Text(
          'Helping Hand',
          style: TextStyle(
            color: Colors.white,
            fontSize: 24,
            fontWeight: FontWeight.bold,
            letterSpacing: -0.5,
          ),
        ),
        const Text(
          'Worker App',
          style: TextStyle(
            color: AppColors.textDarkSecondary,
            fontSize: 12,
            fontWeight: FontWeight.w600,
            letterSpacing: 0.5,
          ),
        ),
      ],
    );
  }
}

// Custom Phone Input Field for clean light backgrounds
class PhoneNumberFieldLight extends StatelessWidget {
  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final String? errorText;
  const PhoneNumberFieldLight({
    key,
    required this.controller,
    required this.onChanged,
    this.errorText,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          height: 56,
          decoration: BoxDecoration(
            color: Colors.grey[50],
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: errorText != null
                  ? AppColors.statusRed
                  : Colors.grey.shade200,
              width: errorText != null ? 1.5 : 1.0,
            ),
          ),
          child: Row(
            children: [
              const SizedBox(width: 16),
              const Text('🇮🇳', style: TextStyle(fontSize: 20)),
              const SizedBox(width: 8),
              const Text(
                '+91',
                style: TextStyle(
                  color: AppColors.textLightPrimary,
                  fontWeight: FontWeight.bold,
                  fontSize: 16,
                ),
              ),
              const SizedBox(width: 8),
              Container(height: 24, width: 1, color: Colors.black12),
              const SizedBox(width: 12),
              const Icon(
                Icons.phone_outlined,
                color: AppColors.textLightSecondary,
                size: 20,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: TextField(
                  controller: controller,
                  keyboardType: TextInputType.number,
                  maxLength: 10,
                  onChanged: onChanged,
                  style: const TextStyle(
                    color: AppColors.textLightPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                  ),
                  decoration: const InputDecoration(
                    hintText: 'Phone number',
                    hintStyle: TextStyle(
                      color: AppColors.textLightSecondary,
                      fontSize: 15,
                    ),
                    counterText: '',
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            ],
          ),
        ),
        if (errorText != null) ...[
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Row(
              children: [
                const Icon(
                  Icons.error_outline,
                  color: AppColors.statusRed,
                  size: 14,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    errorText!,
                    style: const TextStyle(
                      color: AppColors.statusRed,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

// Custom OTP Input Field for clean light backgrounds
class OtpCodeFieldLight extends StatelessWidget {
  final TextEditingController controller;
  final ValueChanged<String> onChanged;
  final String? errorText;
  const OtpCodeFieldLight({
    key,
    required this.controller,
    required this.onChanged,
    this.errorText,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          height: 56,
          decoration: BoxDecoration(
            color: Colors.grey[50],
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: errorText != null
                  ? AppColors.statusRed
                  : Colors.grey.shade200,
              width: errorText != null ? 1.5 : 1.0,
            ),
          ),
          child: Row(
            children: [
              const SizedBox(width: 16),
              const Icon(
                Icons.lock_outline,
                color: AppColors.textLightSecondary,
                size: 20,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextField(
                  controller: controller,
                  keyboardType: TextInputType.number,
                  maxLength: 6,
                  onChanged: onChanged,
                  style: const TextStyle(
                    color: AppColors.textLightPrimary,
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    letterSpacing: 8.0,
                  ),
                  decoration: const InputDecoration(
                    hintText: 'Enter OTP Code',
                    hintStyle: TextStyle(
                      color: AppColors.textLightSecondary,
                      fontSize: 14,
                      letterSpacing: 0.0,
                    ),
                    counterText: '',
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    contentPadding: EdgeInsets.symmetric(vertical: 12),
                  ),
                ),
              ),
            ],
          ),
        ),
        if (errorText != null) ...[
          const SizedBox(height: 8),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 4),
            child: Row(
              children: [
                const Icon(
                  Icons.error_outline,
                  color: AppColors.statusRed,
                  size: 14,
                ),
                const SizedBox(width: 6),
                Expanded(
                  child: Text(
                    errorText!,
                    style: const TextStyle(
                      color: AppColors.statusRed,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

// CTA Button with scale transition feedback
class PrimaryButton extends StatefulWidget {
  final String text;
  final VoidCallback? onPressed;
  final bool isLoading;
  const PrimaryButton({
    super.key,
    required this.text,
    this.onPressed,
    this.isLoading = false,
  });

  @override
  State<PrimaryButton> createState() => _PrimaryButtonState();
}

class _PrimaryButtonState extends State<PrimaryButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 80),
    );
    _scaleAnimation = Tween<double>(
      begin: 1.0,
      end: 0.96,
    ).animate(CurvedAnimation(parent: _controller, curve: Curves.easeInOut));
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final isEnabled = widget.onPressed != null && !widget.isLoading;
    return ScaleTransition(
      scale: _scaleAnimation,
      child: GestureDetector(
        onTapDown: isEnabled ? (_) => _controller.forward() : null,
        onTapUp: isEnabled ? (_) => _controller.reverse() : null,
        onTapCancel: isEnabled ? () => _controller.reverse() : null,
        child: ElevatedButton(
          onPressed: isEnabled ? widget.onPressed : null,
          style: ElevatedButton.styleFrom(
            backgroundColor: isEnabled
                ? AppColors.accentPurple
                : Colors.grey[200],
            foregroundColor: Colors.white,
            disabledBackgroundColor: Colors.grey[200],
            minimumSize: const Size.fromHeight(56),
            elevation: 0,
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(14),
            ),
          ),
          child: widget.isLoading
              ? Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const SizedBox(
                      height: 18,
                      width: 18,
                      child: CircularProgressIndicator(
                        color: Colors.white,
                        strokeWidth: 2,
                      ),
                    ),
                    const SizedBox(width: 12),
                    Text(
                      _otpStatusText(widget.text),
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.bold,
                        color: Colors.white70,
                      ),
                    ),
                  ],
                )
              : Text(
                  widget.text,
                  style: TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.bold,
                    color: isEnabled
                        ? Colors.white
                        : AppColors.textLightSecondary.withOpacity(0.5),
                  ),
                ),
        ),
      ),
    );
  }

  String _otpStatusText(String originalText) {
    if (originalText.toLowerCase().contains('send')) {
      return 'Sending OTP';
    }
    return 'Verifying';
  }
}

// Security Disclaimer & Links Footer (Light Theme)
class SecurityFooterLight extends StatelessWidget {
  const SecurityFooterLight({super.key});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.security_outlined,
              size: 14,
              color: AppColors.textLightSecondary.withOpacity(0.8),
            ),
            const SizedBox(width: 6),
            Text(
              'Secure login • Your information is protected',
              style: TextStyle(
                color: AppColors.textLightSecondary.withOpacity(0.8),
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            InkWell(
              onTap: () {},
              child: const Text(
                'Terms',
                style: TextStyle(
                  color: AppColors.accentPurple,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  decoration: TextDecoration.underline,
                ),
              ),
            ),
            const SizedBox(width: 16),
            Container(
              width: 4,
              height: 4,
              decoration: BoxDecoration(
                color: AppColors.textLightSecondary.withOpacity(0.4),
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 16),
            InkWell(
              onTap: () {},
              child: const Text(
                'Privacy',
                style: TextStyle(
                  color: AppColors.accentPurple,
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                  decoration: TextDecoration.underline,
                ),
              ),
            ),
          ],
        ),
      ],
    );
  }
}
