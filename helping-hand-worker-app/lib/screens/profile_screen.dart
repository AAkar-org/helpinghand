import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';
import 'login_screen.dart';

class ProfileScreen extends StatefulWidget {
  final String? workerId;
  const ProfileScreen({super.key, this.workerId});

  @override
  State<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends State<ProfileScreen> {
  final _apiService = ApiService();
  
  Map<String, dynamic>? _profileData;
  bool _isLoading = true;
  bool _isToggling = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    String? id = widget.workerId;
    if (id == null) {
      final session = await _apiService.getSession();
      id = session['workerId'];
    }

    if (id == null) {
      setState(() {
        _errorMessage = 'No active worker session';
        _isLoading = false;
      });
      return;
    }

    try {
      final res = await _apiService.getWorkerProfile(id);
      if (res['success'] == true) {
        setState(() {
          _profileData = res['workerProfile'];
          _errorMessage = null;
        });
      } else {
        setState(() => _errorMessage = res['error'] ?? 'Failed to load profile');
      }
    } catch (e) {
      setState(() => _errorMessage = 'Failed to fetch profile: ${e.toString()}');
    } finally {
      setState(() => _isLoading = false);
    }
  }

  Future<void> _toggleAvailability() async {
    if (_profileData == null || _isToggling) return;

    setState(() => _isToggling = true);

    final currentAvailability = _profileData!['isAvailable'] == true;
    final targetAvailability = !currentAvailability;
    final workerId = _profileData!['workerId'];

    double? lat;
    double? lng;

    if (targetAvailability) {
      // Fetch GPS coordinates to publish location
      try {
        LocationPermission permission = await Geolocator.checkPermission();
        if (permission == LocationPermission.denied) {
          permission = await Geolocator.requestPermission();
        }
        if (permission == LocationPermission.always || permission == LocationPermission.whileInUse) {
          final position = await Geolocator.getCurrentPosition(
            desiredAccuracy: LocationAccuracy.high,
          );
          lat = position.latitude;
          lng = position.longitude;
        }
      } catch (e) {
        debugPrint('Location fetching warning: ${e.toString()}');
      }
    }

    try {
      final res = await _apiService.toggleAvailability(
        workerId: workerId,
        isAvailable: targetAvailability,
        lat: lat,
        lng: lng,
      );

      if (res['success'] == true) {
        setState(() {
          _profileData!['isAvailable'] = res['isAvailable'];
        });
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(targetAvailability ? 'You are now AVAILABLE for jobs' : 'You are now OFFLINE'),
              backgroundColor: targetAvailability ? AppColors.statusGreen : AppColors.statusRed,
            ),
          );
        }
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(res['error'] ?? 'Failed to update status'), backgroundColor: AppColors.statusRed),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Connection error: ${e.toString()}'), backgroundColor: AppColors.statusRed),
        );
      }
    } finally {
      setState(() => _isToggling = false);
    }
  }

  Future<void> _logout() async {
    await _apiService.clearSession();
    if (mounted) {
      Navigator.pushAndRemoveUntil(
        context,
        MaterialPageRoute(builder: (context) => const LoginScreen()),
        (route) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    if (_isLoading) {
      return const Scaffold(
        backgroundColor: Colors.white,
        body: Center(child: CircularProgressIndicator(color: AppColors.accentPurple)),
      );
    }

    if (_errorMessage != null) {
      return Scaffold(
        backgroundColor: Colors.white,
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(_errorMessage!, style: const TextStyle(color: Colors.red, fontSize: 16)),
                const SizedBox(height: 20),
                ElevatedButton(onPressed: _loadProfile, child: const Text('Retry')),
              ],
            ),
          ),
        ),
      );
    }

    final data = _profileData!;
    final isAvailable = data['isAvailable'] == true;
    final ratingList = data['reviewsList'] as List? ?? [];
    final shiftsHistory = data['completedShiftsHistory'] as List? ?? [];

    return Scaffold(
      backgroundColor: Colors.white,
      body: SingleChildScrollView(
        child: Column(
          children: [
            // Top Section (Mockup Right Side Style)
            Container(
              decoration: const BoxDecoration(
                color: AppColors.primaryDark,
                borderRadius: BorderRadius.vertical(bottom: Radius.circular(32)),
              ),
              padding: const EdgeInsets.only(top: 60, bottom: 28),
              child: Column(
                children: [
                  // Title Bar & Logout Button
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 24.0),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const BackButton(color: Colors.white),
                        Text(
                          isAvailable ? 'Available' : 'Unavailable',
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        IconButton(
                          icon: const Icon(Icons.logout_rounded, color: Colors.white70),
                          onPressed: _logout,
                        )
                      ],
                    ),
                  ),
                  const SizedBox(height: 12),
                  // Availability Update Toggle Pill
                  ElevatedButton(
                    onPressed: _isToggling ? null : _toggleAvailability,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isAvailable ? AppColors.statusGreen : AppColors.accentPurple,
                      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                      minimumSize: Size.zero,
                    ),
                    child: _isToggling
                        ? const SizedBox(
                            height: 14,
                            width: 14,
                            child: CircularProgressIndicator(color: Colors.white, strokeWidth: 1.5),
                          )
                        : Text(
                            isAvailable ? 'GO OFFLINE' : 'UPDATE STATUS',
                            style: const TextStyle(fontSize: 11, letterSpacing: 0.8),
                          ),
                  ),
                  const SizedBox(height: 24),
                  // User Avatar & Category Details
                  Center(
                    child: Stack(
                      alignment: Alignment.bottomRight,
                      children: [
                        CircleAvatar(
                          radius: 50,
                          backgroundColor: Colors.white,
                          child: CircleAvatar(
                            radius: 46,
                            backgroundColor: Colors.grey[200],
                            child: const Icon(Icons.person, size: 50, color: AppColors.primaryDark),
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.all(6),
                          decoration: const BoxDecoration(
                            color: AppColors.statusGreen,
                            shape: BoxShape.circle,
                          ),
                          child: Container(
                            width: 10,
                            height: 10,
                            decoration: const BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    'Ramesh Kumar', // Static simulated name
                    style: theme.textTheme.headlineMedium?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    data['workerCategory'] ?? 'Worker',
                    style: const TextStyle(color: AppColors.textDarkSecondary, fontSize: 13),
                  ),
                  const SizedBox(height: 28),
                  // Stats Row
                  Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 32.0),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceAround,
                      children: [
                        _buildStatCol(data['totalCompletedShifts']?.toString() ?? '0', 'Completed'),
                        _buildStatDivider(),
                        _buildStatCol(data['totalRatingsCount']?.toString() ?? '0', 'Ratings'),
                        _buildStatDivider(),
                        _buildStatCol('${data['trustScore'] ?? '5.0'} ⭐', 'Trust Score'),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            
            // Bottom Content
            Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Skills Section
                  Text(
                    'Skills',
                    style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      _buildSkillChip(data['workerCategory'] ?? 'General'),
                      if (data['workerSubCategory'] != null && data['workerSubCategory'].toString().isNotEmpty) ...[
                        const SizedBox(width: 8),
                        _buildSkillChip(data['workerSubCategory']!),
                      ],
                    ],
                  ),
                  const SizedBox(height: 28),

                  // Experience / History Section
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Experience',
                        style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                      ),
                      Text(
                        '${shiftsHistory.length} Shifts',
                        style: const TextStyle(color: AppColors.textLightSecondary, fontSize: 12),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  if (shiftsHistory.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8.0),
                      child: Text('No completed shifts found yet.', style: TextStyle(color: Colors.black45)),
                    )
                  else
                    ...shiftsHistory.take(3).map((s) => _buildExperienceItem(s)),
                  const SizedBox(height: 28),

                  // Reviews List Section
                  Text(
                    'Recent Reviews',
                    style: theme.textTheme.titleMedium?.copyWith(fontWeight: FontWeight.bold),
                  ),
                  const SizedBox(height: 12),
                  if (ratingList.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8.0),
                      child: Text('No reviews submitted yet.', style: TextStyle(color: Colors.black45)),
                    )
                  else
                    ...ratingList.take(2).map((r) => _buildReviewItem(r)),
                ],
              ),
            )
          ],
        ),
      ),
    );
  }

  Widget _buildStatCol(String value, String label) {
    return Column(
      children: [
        Text(
          value,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 18,
            fontWeight: FontWeight.bold,
          ),
        ),
        const SizedBox(height: 4),
        Text(
          label,
          style: const TextStyle(
            color: AppColors.textDarkSecondary,
            fontSize: 11,
          ),
        ),
      ],
    );
  }

  Widget _buildStatDivider() {
    return Container(
      width: 1,
      height: 24,
      color: Colors.white24,
    );
  }

  Widget _buildSkillChip(String label) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: AppColors.surfaceOff,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Text(
        label,
        style: const TextStyle(
          color: AppColors.textLightPrimary,
          fontWeight: FontWeight.bold,
          fontSize: 13,
        ),
      ),
    );
  }

  Widget _buildExperienceItem(dynamic shift) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.surfaceOff,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: const BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.business_center, color: AppColors.accentPurple, size: 20),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  shift['employerName'] ?? 'Employer',
                  style: const TextStyle(
                    color: AppColors.textLightPrimary,
                    fontWeight: FontWeight.bold,
                    fontSize: 14,
                  ),
                ),
                Text(
                  'Worked ${shift['workedHours'] ?? 8}h  •  Wage Paid: ₹${shift['wage']}',
                  style: const TextStyle(
                    color: AppColors.textLightSecondary,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          const Icon(Icons.check_circle, color: AppColors.statusGreen, size: 20),
        ],
      ),
    );
  }

  Widget _buildReviewItem(dynamic review) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade100),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                review['reviewerName'] ?? 'Anonymous',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
              ),
              Row(
                children: List.generate(5, (index) {
                  final rating = (review['stars'] as num?)?.toInt() ?? 5;
                  return Icon(
                    Icons.star,
                    size: 14,
                    color: index < rating ? Colors.amber : Colors.grey.shade200,
                  );
                }),
              )
            ],
          ),
          const SizedBox(height: 8),
          Text(
            review['comment'] ?? 'No comment provided.',
            style: const TextStyle(color: AppColors.textLightSecondary, fontSize: 12),
          ),
        ],
      ),
    );
  }
}
