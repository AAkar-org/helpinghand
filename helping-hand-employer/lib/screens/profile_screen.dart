import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfaceOffWhite,
      appBar: AppBar(
        backgroundColor: AppColors.surfaceWhite,
        elevation: 0,
        title: const Text('Profile & Settings', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold)),
      ),
      body: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Profile Header
            Container(
              color: AppColors.surfaceWhite,
              padding: const EdgeInsets.all(24.0),
              child: Column(
                children: [
                  const CircleAvatar(
                    radius: 40,
                    backgroundColor: AppColors.primaryLight,
                    child: Text('JR', style: TextStyle(color: AppColors.primary, fontSize: 32, fontWeight: FontWeight.bold)),
                  ),
                  const SizedBox(height: 16),
                  const Text('Jessica Reynolds', style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
                  const SizedBox(height: 4),
                  const Text('Manager, BuildCo Ltd.', style: TextStyle(fontSize: 14, color: AppColors.textSecondary)),
                  const SizedBox(height: 24),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                    children: [
                      _buildStatColumn('142', 'Shifts Posted'),
                      Container(width: 1, height: 40, color: AppColors.borderLight),
                      _buildStatColumn('4.9', 'Avg Rating'),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 8),

            // Company & Billing
            _buildSectionHeader('Company & Billing'),
            _buildListTile(Icons.business, 'Company Details', 'BuildCo Ltd.'),
            _buildListTile(Icons.credit_card, 'Payment Methods', 'Visa ending in 4242'),
            _buildListTile(Icons.receipt_long, 'Billing History', 'View past invoices'),

            const SizedBox(height: 8),
            // Workers
            _buildSectionHeader('My Workers'),
            _buildListTile(Icons.favorite_border, 'Saved Workers', '12 workers'),
            _buildListTile(Icons.star_border, 'My Reviews', 'Past feedback'),

            const SizedBox(height: 8),
            // Settings
            _buildSectionHeader('Preferences'),
            _buildListTile(Icons.notifications_none, 'Notifications', 'On'),
            _buildListTile(Icons.lock_outline, 'Privacy & Security', ''),
            _buildListTile(Icons.help_outline, 'Help & Support', ''),

            const SizedBox(height: 24),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16.0),
              child: OutlinedButton(
                onPressed: () {},
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
        Text(value, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold, color: AppColors.textPrimary)),
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
