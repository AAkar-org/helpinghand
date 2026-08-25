import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';

class CreateShiftScreen extends StatefulWidget {
  final String? targetWorkerId;
  const CreateShiftScreen({super.key, this.targetWorkerId});

  @override
  State<CreateShiftScreen> createState() => _CreateShiftScreenState();
}

class _CreateShiftScreenState extends State<CreateShiftScreen> {
  final ApiService _apiService = ApiService();
  String _selectedCategory = 'Construction';
  final List<String> _categories = ['Construction', 'Warehouse', 'Delivery', 'Cleaning', 'General Labor'];

  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _workersNeededController = TextEditingController(text: '1');
  final TextEditingController _wageController = TextEditingController(text: '800');
  final TextEditingController _requirementsController = TextEditingController();
  final TextEditingController _addressController = TextEditingController();

  bool _isSubmitting = false;

  @override
  void dispose() {
    _titleController.dispose();
    _workersNeededController.dispose();
    _wageController.dispose();
    _requirementsController.dispose();
    _addressController.dispose();
    super.dispose();
  }

  Future<void> _submitShift() async {
    final wageText = _wageController.text.trim();
    final wage = double.tryParse(wageText);

    if (wage == null || wage <= 0) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a valid daily wage rate')),
      );
      return;
    }

    setState(() {
      _isSubmitting = true;
    });

    try {
      final session = await _apiService.getSession();
      final employerId = session['employerId'] ?? 'e1111111-1111-1111-1111-111111111111';
      final workerId = widget.targetWorkerId ?? 'w1111111-1111-1111-1111-111111111111';

      final response = await _apiService.createShift(
        employerId: employerId,
        workerId: workerId,
        agreedDailyWage: wage,
      );

      if (!mounted) return;

      if (response['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Shift posted successfully!')),
        );
        Navigator.pop(context, true);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(response['error'] ?? 'Failed to post shift')),
        );
      }
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error creating shift: $e')),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Post a Shift'),
        backgroundColor: AppColors.surfaceWhite,
        elevation: 1,
        shadowColor: Colors.black.withValues(alpha: 0.1),
        foregroundColor: AppColors.textPrimary,
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text('Labor Category', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12),
                decoration: BoxDecoration(
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: AppColors.borderLight, width: 1.5),
                  color: Colors.white,
                ),
                child: DropdownButtonHideUnderline(
                  child: DropdownButton<String>(
                    value: _selectedCategory,
                    isExpanded: true,
                    icon: const Icon(Icons.arrow_drop_down, color: AppColors.textSecondary),
                    items: _categories.map((String value) {
                      return DropdownMenuItem<String>(
                        value: value,
                        child: Text(value),
                      );
                    }).toList(),
                    onChanged: (newValue) {
                      if (newValue != null) {
                        setState(() {
                          _selectedCategory = newValue;
                        });
                      }
                    },
                  ),
                ),
              ),
              const SizedBox(height: 20),
              
              const Text('Shift Details', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
              const SizedBox(height: 8),
              TextField(
                controller: _titleController,
                decoration: const InputDecoration(
                  labelText: 'Job Title or Description',
                  hintText: 'e.g., Unload delivery truck',
                ),
              ),
              const SizedBox(height: 20),

              const Text('Requirements & Pay', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      controller: _workersNeededController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Workers Needed',
                        hintText: 'e.g., 2',
                        prefixIcon: Icon(Icons.people_outline, size: 20),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: TextField(
                      controller: _wageController,
                      keyboardType: TextInputType.number,
                      decoration: const InputDecoration(
                        labelText: 'Daily Wage (₹)',
                        hintText: 'e.g., 800',
                        prefixIcon: Icon(Icons.currency_rupee, size: 20),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              TextField(
                controller: _requirementsController,
                maxLines: 3,
                decoration: const InputDecoration(
                  labelText: 'Specific Requirements (Optional)',
                  hintText: 'e.g., Must have steel-toe boots...',
                ),
              ),
              const SizedBox(height: 20),
              
              const Text('Location', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
              const SizedBox(height: 8),
              TextField(
                controller: _addressController,
                decoration: const InputDecoration(
                  labelText: 'Worksite Address',
                  hintText: 'Enter address or use current location',
                  prefixIcon: Icon(Icons.location_on_outlined, size: 20),
                  suffixIcon: Icon(Icons.my_location, color: AppColors.primary),
                ),
              ),
              
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: ElevatedButton(
            onPressed: _isSubmitting ? null : _submitShift,
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
            child: _isSubmitting
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                  )
                : const Text('Post Shift'),
          ),
        ),
      ),
    );
  }
}
