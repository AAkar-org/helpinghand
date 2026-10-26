import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';
import 'login_screen.dart';

class ProfileScreen extends StatefulWidget {
  const ProfileScreen({super.key});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final ApiService _apiService = ApiService();
  String _employerName = 'Employer User';
  String _phoneNumber = '';
  String? _email;
  String? _avatarUrl;
  String? _upiId;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    try {
      final session = await _apiService.getSession();
      if (!mounted) return;
      setState(() {
        _employerName = session['fullName']?.isNotEmpty == true ? session['fullName']! : 'Employer User';
        _phoneNumber = session['phoneNumber'] ?? '';
        _email = session['email'];
        _avatarUrl = session['avatarUrl'];
        _upiId = session['upiId'];
        _isLoading = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _logout() async {
    await _apiService.clearSession();
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Logged out successfully')),
    );
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (context) => const EmployerLoginScreen()),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfaceOffWhite,
      appBar: AppBar(
        backgroundColor: AppColors.surfaceWhite,
        elevation: 0,
        title: const Text('Profile & Settings', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold)),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Container(
                    color: AppColors.surfaceWhite,
                    padding: const EdgeInsets.all(24.0),
                    child: Column(
                      children: [
                        CircleAvatar(
                          radius: 40,
                          backgroundColor: AppColors.primaryLight,
                          backgroundImage: _avatarUrl != null && _avatarUrl!.isNotEmpty ? NetworkImage(_avatarUrl!) : null,
                          child: _avatarUrl == null || _avatarUrl!.isEmpty
                              ? Text(
                                  _employerName.isNotEmpty ? _employerName[0].toUpperCase() : 'E',
                                  style: const TextStyle(color: AppColors.primary, fontSize: 32, fontWeight: FontWeight.bold),
                                )
                              : null,
                        ),
                        const SizedBox(height: 16),
                        Text(_employerName, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                        const SizedBox(height: 4),
                        Text(_email != null && _email!.isNotEmpty ? '$_phoneNumber • $_email' : _phoneNumber,
                            style: const TextStyle(fontSize: 14, color: AppColors.textSecondary)),
                        const SizedBox(height: 24),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                          children: [
                            _buildStatColumn('Verified', 'Status'),
                            Container(width: 1, height: 40, color: AppColors.borderLight),
                            _buildStatColumn('5.0 ⭐', 'Trust Score'),
                          ],
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 8),

                  _buildSectionHeader('Account & Billing'),
                  _buildListTile(Icons.phone, 'Phone Number', _phoneNumber),
                  _buildListTile(Icons.account_balance_wallet, 'UPI ID', _upiId ?? 'Not configured'),
                  _buildListTile(Icons.receipt_long, 'Billing History', 'View past transactions'),

                  const SizedBox(height: 8),
                  _buildSectionHeader('Preferences'),
                  _buildListTile(Icons.notifications_none, 'Notifications', 'Enabled'),
                  _buildListTile(Icons.lock_outline, 'Privacy & Security', ''),
                  _buildListTile(Icons.help_outline, 'Help & Support', ''),

                  const SizedBox(height: 24),
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16.0),
                    child: OutlinedButton(
                      onPressed: _logout,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: AppColors.statusRed,
                        side: const BorderSide(color: AppColors.statusRedLight),
                        padding: const EdgeInsets.symmetric(vertical: 16),
                      ),
                      child: const Text('Log Out'),
                    ),
                  ),
                  const SizedBox(height: 32),
                ],
              ),
            ),
    );
  }

  Widget _buildStatColumn(String value, String label) {
    return Column(
      children: [
        Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
      ],
    );
  }

  Widget _buildSectionHeader(String title) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(16, 24, 16, 8),
      child: Text(
        title.toUpperCase(),
        style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: AppColors.textSecondary, letterSpacing: 1),
      ),
    );
  }

  Widget _buildListTile(IconData icon, String title, String trailingText) {
    return Container(
      color: AppColors.surfaceWhite,
      child: ListTile(
        leading: Container(
          padding: const EdgeInsets.all(8),
          decoration: BoxDecoration(
            color: AppColors.surfaceOffWhite,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Icon(icon, color: AppColors.textPrimary, size: 20),
        ),
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 15, color: AppColors.textPrimary)),
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (trailingText.isNotEmpty)
              Text(trailingText, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
            const SizedBox(width: 8),
            const Icon(Icons.chevron_right, color: AppColors.borderLight, size: 20),
          ],
        ),
        onTap: () {},
      ),
    );
  }
}
