import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';

class ShiftsScreen extends StatefulWidget {
  const ShiftsScreen({super.key});

  @override
  State<ShiftsScreen> createState() => _ShiftsScreenState();
}

class _ShiftsScreenState extends State<ShiftsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final ApiService _apiService = ApiService();

  List<dynamic> _shifts = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _loadShifts();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _loadShifts() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final session = await _apiService.getSession();
      final employerId = session['employerId'] ?? 'e1111111-1111-1111-1111-111111111111';

      final response = await _apiService.getEmployerShifts(employerId);
      if (!mounted) return;

      if (response['success'] == true) {
        setState(() {
          _shifts = response['shifts'] ?? [];
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading shifts: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  List<dynamic> _filterShifts(String category) {
    if (category == 'Upcoming') {
      return _shifts.where((s) => s['status'] == 'PENDING' || s['status'] == 'ACCEPTED').toList();
    } else if (category == 'Active') {
      return _shifts.where((s) => s['status'] == 'ACTIVE').toList();
    } else {
      return _shifts.where((s) => s['status'] == 'COMPLETED' || s['status'] == 'CANCELLED').toList();
    }
  }

  Future<void> _handleReconcileCash(Map<String, dynamic> shift) async {
    final String shiftId = shift['shift_id'];
    setState(() {
      _isLoading = true;
    });

    try {
      final response = await _apiService.reconcileCash(
        shiftId: shiftId,
        workerLat: 28.6139,
        workerLng: 77.2090,
        employerLat: 28.6139,
        employerLng: 77.2090,
        cashAmount: double.tryParse('${shift['adjusted_wage'] ?? shift['agreed_daily_wage']}'),
      );

      if (!mounted) return;

      if (response['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Cash payment reconciled & IVR verification triggered!')),
        );
        _loadShifts();
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(response['error'] ?? 'Reconciliation failed')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error in reconciliation: $e')),
        );
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
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
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.textPrimary),
            onPressed: _loadShifts,
          ),
        ],
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
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildShiftsList(_filterShifts('Upcoming')),
                _buildShiftsList(_filterShifts('Active')),
                _buildShiftsList(_filterShifts('Past')),
              ],
            ),
    );
  }

  Widget _buildShiftsList(List<dynamic> items) {
    if (items.isEmpty) {
      return const Center(
        child: Text(
          'No shifts found in this tab.',
          style: TextStyle(color: AppColors.textSecondary, fontSize: 16),
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      itemBuilder: (context, index) {
        final shift = items[index];
        return _buildShiftCard(shift);
      },
    );
  }

  Widget _buildShiftCard(Map<String, dynamic> shift) {
    final String status = shift['status'] ?? 'PENDING';
    final String wage = '₹${shift['adjusted_wage'] ?? shift['agreed_daily_wage']}';
    Color statusColor = AppColors.primary;
    if (status == 'ACTIVE') statusColor = AppColors.statusGreen;
    if (status == 'COMPLETED') statusColor = AppColors.textSecondary;

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
                Expanded(
                  child: Text(
                    'Shift #${shift['shift_id'].toString().substring(0, 8)}',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: statusColor.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Text(
                    status,
                    style: TextStyle(color: statusColor, fontSize: 12, fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                const Icon(Icons.currency_rupee, size: 16, color: AppColors.textSecondary),
                const SizedBox(width: 8),
                Text('Agreed Daily Wage: $wage', style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
              ],
            ),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.calendar_today, size: 16, color: AppColors.textSecondary),
                const SizedBox(width: 8),
                Text('Created: ${shift['created_at']?.toString().substring(0, 10) ?? 'Today'}',
                    style: const TextStyle(color: AppColors.textSecondary, fontSize: 13)),
              ],
            ),
            const SizedBox(height: 16),
            if (status == 'ACTIVE')
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () => _handleReconcileCash(shift),
                  icon: const Icon(Icons.check_circle, size: 18),
                  label: const Text('Reconcile Cash & End Shift'),
                  style: ElevatedButton.styleFrom(backgroundColor: AppColors.statusGreen),
                ),
              )
            else
              SizedBox(
                width: double.infinity,
                child: OutlinedButton(
                  onPressed: () {},
                  style: OutlinedButton.styleFrom(
                    side: const BorderSide(color: AppColors.borderLight),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  child: Text(
                    status == 'COMPLETED' ? 'View Receipt & Rating' : 'Shift Details',
                    style: const TextStyle(color: AppColors.primary),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}
