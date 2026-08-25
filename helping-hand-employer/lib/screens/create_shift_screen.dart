import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

class CreateShiftScreen extends StatefulWidget {
  const CreateShiftScreen({super.key});

  @override
  State<CreateShiftScreen> createState() => _CreateShiftScreenState();
}

class _CreateShiftScreenState extends State<CreateShiftScreen> {
  String _selectedCategory = 'Construction';
  final List<String> _categories = ['Construction', 'Warehouse', 'Delivery', 'Cleaning', 'General Labor'];

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
                      setState(() {
                        _selectedCategory = newValue!;
                      });
                    },
                  ),
                ),
              ),
              const SizedBox(height: 20),
              
              const Text('Shift Details', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
              const SizedBox(height: 8),
              const TextField(
                decoration: InputDecoration(
                  labelText: 'Job Title or Description',
                  hintText: 'e.g., Unload delivery truck',
                ),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      decoration: InputDecoration(
                        labelText: 'Date',
                        hintText: 'Select Date',
                        prefixIcon: const Icon(Icons.calendar_today, size: 20),
                      ),
                      readOnly: true,
                      onTap: () {},
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: TextField(
                      decoration: InputDecoration(
                        labelText: 'Time',
                        hintText: 'Select Time',
                        prefixIcon: const Icon(Icons.access_time, size: 20),
                      ),
                      readOnly: true,
                      onTap: () {},
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),

              const Text('Requirements & Pay', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
              const SizedBox(height: 8),
              Row(
                children: [
                  Expanded(
                    child: TextField(
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: 'Workers Needed',
                        hintText: 'e.g., 2',
                        prefixIcon: const Icon(Icons.people_outline, size: 20),
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: TextField(
                      keyboardType: TextInputType.number,
                      decoration: InputDecoration(
                        labelText: 'Hourly Rate (₹)',
                        hintText: 'e.g., 500',
                        prefixIcon: const Icon(Icons.currency_rupee, size: 20),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              const TextField(
                maxLines: 3,
                decoration: InputDecoration(
                  labelText: 'Specific Requirements (Optional)',
                  hintText: 'e.g., Must have steel-toe boots...',
                ),
              ),
              const SizedBox(height: 20),
              
              const Text('Location', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 16)),
              const SizedBox(height: 8),
              const TextField(
                decoration: InputDecoration(
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
            onPressed: () {
              Navigator.pop(context);
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Shift posted successfully!')),
              );
            },
            style: ElevatedButton.styleFrom(
              padding: const EdgeInsets.symmetric(vertical: 16),
            ),
            child: const Text('Post Shift'),
          ),
        ),
      ),
    );
  }
}
