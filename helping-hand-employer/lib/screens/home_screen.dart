import 'package:flutter/material.dart';
import '../theme/app_colors.dart';
import 'shifts_screen.dart';
import 'profile_screen.dart';
import 'map_screen.dart';
import 'create_shift_screen.dart'; // We'll create this next

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;
  final String _managerName = 'Jessica';

  Widget _buildDashboardTab() {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: AppColors.surfaceOffWhite,
      appBar: AppBar(
        backgroundColor: AppColors.surfaceOffWhite,
        elevation: 0,
        toolbarHeight: 80,
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Good Morning,',
              style: theme.textTheme.bodyMedium,
            ),
            Text(
              _managerName,
              style: theme.textTheme.headlineLarge,
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_outlined, color: AppColors.textPrimary, size: 28),
            onPressed: () {},
          ),
          const Padding(
            padding: EdgeInsets.only(right: 16.0, left: 8.0),
            child: CircleAvatar(
              radius: 20,
              backgroundColor: AppColors.primaryLight,
              child: Text(
                'JR',
                style: TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold),
              ),
            ),
          )
        ],
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Stats Row
              Row(
                children: [
                  Expanded(child: _buildStatCard('Active Shifts', '18', Icons.work_outline, AppColors.primary)),
                  const SizedBox(width: 16),
                  Expanded(child: _buildStatCard('Total Spent', '₹1.2L', Icons.currency_rupee, AppColors.statusGreen)),
                ],
              ),
              const SizedBox(height: 32),
              
              // Book Services / Categories
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text('Book Labor', style: theme.textTheme.titleLarge),
                  TextButton(onPressed: () {}, child: const Text('See All')),
                ],
              ),
              const SizedBox(height: 12),
              SizedBox(
                height: 110,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  children: [
                    _buildCategoryCard('Construction', Icons.construction, Colors.orange),
                    _buildCategoryCard('Warehouse', Icons.inventory, Colors.blue),
                    _buildCategoryCard('Delivery', Icons.local_shipping, Colors.green),
                    _buildCategoryCard('Cleaning', Icons.cleaning_services, Colors.purple),
                  ],
                ),
              ),
              
              const SizedBox(height: 32),

              // Urgent Coverage Alerts Card
              Text('Needs Attention', style: theme.textTheme.titleLarge),
              const SizedBox(height: 16),
              Card(
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                  side: const BorderSide(color: AppColors.statusRedLight, width: 2),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(16.0),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.warning_amber_rounded, color: AppColors.statusRed),
                              const SizedBox(width: 8),
                              Text('Coverage Gap', style: theme.textTheme.titleMedium?.copyWith(color: AppColors.statusRed)),
                            ],
                          ),
                          const Text('Today 2:00 PM', style: TextStyle(color: AppColors.textSecondary, fontSize: 12)),
                        ],
                      ),
                      const SizedBox(height: 12),
                      const Text('Delivery Driver - 1 No Show. Need replacement urgently.', style: TextStyle(color: AppColors.textPrimary)),
                      const SizedBox(height: 16),
                      SizedBox(
                        width: double.infinity,
                        child: ElevatedButton(
                          onPressed: () {},
                          style: ElevatedButton.styleFrom(backgroundColor: AppColors.statusRed),
                          child: const Text('Find Replacement Now'),
                        ),
                      )
                    ],
                  ),
                ),
              ),
              const SizedBox(height: 24),
              
              // Recent Shifts
              Text('Recent Shifts', style: theme.textTheme.titleLarge),
              const SizedBox(height: 16),
              _buildShiftRow('Warehouse Staff', '7/8 Active', 0.85, Icons.warehouse),
              const SizedBox(height: 12),
              _buildShiftRow('Delivery Drivers', '6/6 Active', 1.0, Icons.local_shipping),
              
              const SizedBox(height: 100), // Padding for FAB
            ],
          ),
        ),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () {
          Navigator.push(
            context,
            MaterialPageRoute(builder: (context) => const CreateShiftScreen()),
          );
        },
        icon: const Icon(Icons.add),
        label: const Text('Post Shift'),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
    );
  }

  Widget _buildStatCard(String title, String value, IconData icon, Color color) {
    return Card(
      elevation: 0,
      color: color.withValues(alpha: 0.1),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16), side: BorderSide.none),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: color, size: 28),
            const SizedBox(height: 12),
            Text(title, style: TextStyle(color: AppColors.textSecondary, fontSize: 13, fontWeight: FontWeight.w500)),
            const SizedBox(height: 4),
            Text(value, style: TextStyle(color: AppColors.textPrimary, fontSize: 24, fontWeight: FontWeight.w800)),
          ],
        ),
      ),
    );
  }

  Widget _buildCategoryCard(String title, IconData icon, Color color) {
    return Container(
      width: 100,
      margin: const EdgeInsets.only(right: 12),
      child: Card(
        child: InkWell(
          onTap: () {},
          borderRadius: BorderRadius.circular(16),
          child: Padding(
            padding: const EdgeInsets.all(12.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: color.withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(icon, color: color, size: 28),
                ),
                const SizedBox(height: 8),
                Text(
                  title,
                  style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.textPrimary),
                  textAlign: TextAlign.center,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildShiftRow(String title, String status, double progress, IconData icon) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.surfaceOffWhite,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: AppColors.textPrimary, size: 24),
            ),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16, color: AppColors.textPrimary)),
                  const SizedBox(height: 4),
                  Text(status, style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
                  const SizedBox(height: 8),
                  LinearProgressIndicator(
                    value: progress,
                    backgroundColor: AppColors.borderLight,
                    valueColor: AlwaysStoppedAnimation<Color>(
                      progress == 1.0 ? AppColors.statusGreen : AppColors.primary,
                    ),
                    minHeight: 6,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ],
              ),
            ),
            const SizedBox(width: 8),
            const Icon(Icons.chevron_right, color: AppColors.textSecondary),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> tabs = [
      _buildDashboardTab(),
      const ShiftsScreen(), // Schedule/Shifts
      const MapScreen(), // Map
      const ProfileScreen(), // Profile
    ];

    return Scaffold(
      body: IndexedStack(index: _currentIndex, children: tabs),
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 10,
              offset: const Offset(0, -5),
            ),
          ],
        ),
        child: BottomNavigationBar(
          currentIndex: _currentIndex,
          onTap: (index) => setState(() => _currentIndex = index),
          backgroundColor: Colors.white,
          selectedItemColor: AppColors.primary,
          unselectedItemColor: AppColors.textSecondary,
          showSelectedLabels: true,
          showUnselectedLabels: true,
          type: BottomNavigationBarType.fixed,
          elevation: 0,
          selectedFontSize: 12,
          unselectedFontSize: 12,
          items: const [
            BottomNavigationBarItem(icon: Icon(Icons.home_outlined), activeIcon: Icon(Icons.home), label: 'Home'),
            BottomNavigationBarItem(icon: Icon(Icons.work_outline), activeIcon: Icon(Icons.work), label: 'Shifts'),
            BottomNavigationBarItem(icon: Icon(Icons.map_outlined), activeIcon: Icon(Icons.map), label: 'Map'),
            BottomNavigationBarItem(icon: Icon(Icons.person_outline), activeIcon: Icon(Icons.person), label: 'Profile'),
          ],
        ),
      ),
    );
  }
}
