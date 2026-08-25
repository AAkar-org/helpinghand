import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class ShiftsScreen extends StatefulWidget {
  const ShiftsScreen({super.key});

  @override
  State<ShiftsScreen> createState() => _ShiftsScreenState();
}

class _ShiftsScreenState extends State<ShiftsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfaceOffWhite,
      appBar: AppBar(
        backgroundColor: AppColors.surfaceWhite,
        elevation: 1,
        shadowColor: Colors.black.withValues(alpha: 0.05),
        title: const Text('My Shifts', style: TextStyle(color: AppColors.textPrimary, fontWeight: FontWeight.bold)),
        bottom: TabBar(
          controller: _tabController,
          labelColor: AppColors.primary,
          unselectedLabelColor: AppColors.textSecondary,
          indicatorColor: AppColors.primary,
          indicatorWeight: 3,
          tabs: const [
            Tab(text: 'Upcoming'),
            Tab(text: 'Active'),
            Tab(text: 'Past'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildShiftsList(isUpcoming: true),
          _buildShiftsList(isActive: true),
          _buildShiftsList(isPast: true),
        ],
      ),
    );
  }

  Widget _buildShiftsList({bool isUpcoming = false, bool isActive = false, bool isPast = false}) {
    // Dummy data based on the tab
    if (isUpcoming) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildShiftCard('Construction - Foundation', 'Tomorrow, 8:00 AM - 4:00 PM', '4 Workers', AppColors.primary, 'Scheduled'),
          _buildShiftCard('Warehouse Unloading', 'Fri, Nov 1, 9:00 AM - 1:00 PM', '2 Workers', AppColors.primary, 'Pending Responses'),
        ],
      );
    } else if (isActive) {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildShiftCard('Delivery Drivers', 'Today, 9:00 AM - 6:00 PM', '6/6 Workers Present', AppColors.statusGreen, 'In Progress'),
          _buildShiftCard('Warehouse Staff', 'Today, 10:00 AM - 5:00 PM', '7/8 Workers Present', AppColors.statusOrange, 'Needs Coverage'),
        ],
      );
    } else {
      return ListView(
        padding: const EdgeInsets.all(16),
        children: [
          _buildShiftCard('Event Cleanup', 'Mon, Oct 21, 6:00 PM - 10:00 PM', '5 Workers', AppColors.textSecondary, 'Completed'),
          _buildShiftCard('General Labor', 'Sun, Oct 20, 8:00 AM - 12:00 PM', '2 Workers', AppColors.textSecondary, 'Completed'),
        ],
      );
    }
  }

  Widget _buildShiftCard(String title, String time, String workers, Color statusColor, String statusText) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(child: Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16))),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(statusText, style: TextStyle(color: statusColor, fontSize: 12, fontWeight: FontWeight.w600)),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                const Icon(Icons.access_time, size: 16, color: AppColors.textSecondary),
                const SizedBox(width: 8),
                Text(time, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.people_outline, size: 16, color: AppColors.textSecondary),
                const SizedBox(width: 8),
                Text(workers, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
              ],
            ),
            const SizedBox(height: 16),
            SizedBox(
              width: double.infinity,
              child: OutlinedButton(
                onPressed: () {},
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppColors.borderLight),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: Text(statusText == 'Completed' ? 'View Details & Receipt' : 'Manage Shift', style: const TextStyle(color: AppColors.primary)),
              ),
            )
          ],
        ),
      ),
    );
  }
}
