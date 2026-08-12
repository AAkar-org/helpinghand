import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';
import 'shifts_screen.dart';
import 'profile_screen.dart';
import 'shift_detail_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _currentIndex = 0;
  final String _workerName = 'Ramesh Kumar'; // Simulated display name
  String _workerCategory = 'ELECTRICIAN';
  String _workerSubCategory = 'House Wiring';
  String? _workerId;

  final _apiService = ApiService();

  @override
  void initState() {
    super.initState();
    _loadWorkerInfo();
  }

  Future<void> _loadWorkerInfo() async {
    final session = await _apiService.getSession();
    setState(() {
      _workerId = session['workerId'];
      _workerCategory = session['category'] ?? 'ELECTRICIAN';
      _workerSubCategory = session['subCategory'] ?? 'General Skills';
    });
  }

  Widget _buildHomeTab() {
    final theme = Theme.of(context);
    return Scaffold(
      backgroundColor: AppColors.primaryDark,
      body: SafeArea(
        child: SingleChildScrollView(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Header matching Left Panel of the mockup
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 24,
                  vertical: 20,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    IconButton(
                      icon: const Icon(
                        Icons.grid_view_rounded,
                        color: Colors.white,
                        size: 28,
                      ),
                      onPressed: () {},
                    ),
                    const CircleAvatar(
                      radius: 20,
                      backgroundColor: AppColors.primaryLight,
                      child: Text(
                        'RK',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Find your\ndream job',
                      style: theme.textTheme.headlineLarge?.copyWith(
                        fontSize: 34,
                        fontWeight: FontWeight.bold,
                        height: 1.1,
                      ),
                    ),
                    const SizedBox(height: 24),
                    // Horizontal Filter list
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(12),
                            decoration: BoxDecoration(
                              color: AppColors.primaryLight.withValues(
                                alpha: 0.5,
                              ),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(
                              Icons.tune_rounded,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(width: 12),
                          _buildFilterChip('Fulltime', true),
                          _buildFilterChip('New York', false),
                          _buildFilterChip('Product', false),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 28),
              // "For You" Section
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Text(
                  'For You',
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                height: 180,
                child: ListView(
                  scrollDirection: Axis.horizontal,
                  padding: const EdgeInsets.only(left: 24, right: 8),
                  children: [
                    _buildDreamJobCard(
                      employerName: 'Suresh Builders',
                      role: 'Senior Electrician',
                      wage: '₹950 / Day',
                      location: 'Kothrud, Pune',
                      ageText: '2 hours ago',
                      logoColor: Colors.amber,
                      logoIcon: Icons.electrical_services,
                    ),
                    _buildDreamJobCard(
                      employerName: 'Tandem Infra',
                      role: 'Wiring Assistant',
                      wage: '₹600 / Day',
                      location: 'Pimple Saudagar',
                      ageText: '1 day ago',
                      logoColor: Colors.blue,
                      logoIcon: Icons.bolt,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 28),
              // "New Added" Section
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'New Added',
                      style: theme.textTheme.titleMedium?.copyWith(
                        color: Colors.white,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                    TextButton(
                      onPressed: () {},
                      child: const Text(
                        'Show All',
                        style: TextStyle(color: AppColors.textDarkSecondary),
                      ),
                    ),
                  ],
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 24),
                child: Column(
                  children: [
                    _buildNewAddedItem(
                      employerName: 'Bhosari Metro Projects',
                      role: 'Industrial Cable Layer',
                      wage: '₹1,100 / Day',
                      location: 'Bhosari MIDC',
                      logoIcon: Icons.settings,
                      logoBgColor: Colors.deepPurple,
                    ),
                    _buildNewAddedItem(
                      employerName: 'Smart Homes Ltd',
                      role: 'Residential Plumber',
                      wage: '₹800 / Day',
                      location: 'Wakad, Pune',
                      logoIcon: Icons.plumbing,
                      logoBgColor: Colors.teal,
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildFilterChip(String label, bool isSelected) {
    return Container(
      margin: const EdgeInsets.only(left: 8),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      decoration: BoxDecoration(
        color: isSelected
            ? AppColors.accentPurple
            : AppColors.primaryMid.withValues(alpha: 0.6),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: isSelected
              ? AppColors.accentPurple
              : AppColors.primaryLight.withValues(alpha: 0.3),
        ),
      ),
      child: Text(
        label,
        style: TextStyle(
          color: isSelected ? Colors.white : AppColors.textDarkSecondary,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }

  Widget _buildDreamJobCard({
    required String employerName,
    required String role,
    required String wage,
    required String location,
    required String ageText,
    required Color logoColor,
    required IconData logoIcon,
  }) {
    return Container(
      width: 280,
      margin: const EdgeInsets.only(right: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: logoColor.withValues(alpha: 0.15),
                  shape: BoxShape.circle,
                ),
                child: Icon(logoIcon, color: logoColor, size: 24),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 4,
                ),
                decoration: BoxDecoration(
                  color: AppColors.surfaceOff,
                  borderRadius: BorderRadius.circular(10),
                ),
                child: const Text(
                  'Fulltime',
                  style: TextStyle(
                    color: AppColors.textLightSecondary,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ],
          ),
          const Spacer(),
          Text(
            role,
            style: const TextStyle(
              color: AppColors.textLightPrimary,
              fontWeight: FontWeight.bold,
              fontSize: 18,
            ),
          ),
          Text(
            employerName,
            style: const TextStyle(
              color: AppColors.textLightSecondary,
              fontSize: 13,
            ),
          ),
          const Spacer(),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                location,
                style: const TextStyle(
                  color: AppColors.textLightSecondary,
                  fontSize: 11,
                ),
              ),
              Text(
                ageText,
                style: const TextStyle(
                  color: AppColors.textLightSecondary,
                  fontSize: 11,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildNewAddedItem({
    required String employerName,
    required String role,
    required String wage,
    required String location,
    required IconData logoIcon,
    required Color logoBgColor,
  }) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.primaryMid.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(
          color: AppColors.primaryLight.withValues(alpha: 0.2),
        ),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: logoBgColor.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(14),
            ),
            child: Icon(logoIcon, color: logoBgColor, size: 24),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  role,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 15,
                  ),
                ),
                Text(
                  employerName,
                  style: const TextStyle(
                    color: AppColors.textDarkSecondary,
                    fontSize: 12,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  wage,
                  style: const TextStyle(
                    color: AppColors.accentPurple,
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                  ),
                ),
              ],
            ),
          ),
          const Icon(
            Icons.arrow_forward_ios_rounded,
            color: Colors.white30,
            size: 16,
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final List<Widget> tabs = [
      _buildHomeTab(),
      const ShiftsScreen(),
      ProfileScreen(workerId: _workerId),
    ];

    return Scaffold(
      body: IndexedStack(index: _currentIndex, children: tabs),
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        backgroundColor: AppColors.primaryDark,
        selectedItemColor: AppColors.accentPurple,
        unselectedItemColor: AppColors.textDarkSecondary.withValues(alpha: 0.6),
        showSelectedLabels: true,
        showUnselectedLabels: false,
        type: BottomNavigationBarType.fixed,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home_filled), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.work), label: 'Shifts'),
          BottomNavigationBarItem(icon: Icon(Icons.person), label: 'Profile'),
        ],
      ),
    );
  }
}
