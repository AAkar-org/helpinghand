import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:geolocator/geolocator.dart';
import '../services/api_service.dart';
import '../theme/app_colors.dart';
import 'create_shift_screen.dart';

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  final ApiService _apiService = ApiService();
  GoogleMapController? _mapController;
  LatLng _userPosition = const LatLng(28.6139, 77.2090);

  Set<Marker> _markers = {};
  List<dynamic> _nearbyWorkers = [];
  bool _isLoading = true;
  String _selectedCategory = 'ALL';

  @override
  void initState() {
    super.initState();
    _initLiveLocationAndFetch();
  }

  Future<void> _initLiveLocationAndFetch() async {
    try {
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }
      if (permission == LocationPermission.whileInUse || permission == LocationPermission.always) {
        final position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            timeLimit: Duration(seconds: 5),
          ),
        );
        _userPosition = LatLng(position.latitude, position.longitude);
        _mapController?.animateCamera(
          CameraUpdate.newLatLngZoom(_userPosition, 13.0),
        );
      }
    } catch (_) {
      // Graceful fallback to default initial position
    }
    await _fetchWorkers();
  }

  Future<void> _fetchWorkers() async {
    setState(() {
      _isLoading = true;
    });

    try {
      final response = await _apiService.findNearbyWorkers(
        lat: _userPosition.latitude,
        lng: _userPosition.longitude,
        radiusKm: 15,
        category: _selectedCategory == 'ALL' ? null : _selectedCategory,
      );

      if (!mounted) return;

      if (response['success'] == true) {
        final List<dynamic> workers = response['workers'] ?? [];
        final Set<Marker> newMarkers = {};

        for (final worker in workers) {
          final String workerId = worker['workerId'];
          final double lat = (worker['lat'] as num).toDouble();
          final double lng = (worker['lng'] as num).toDouble();
          final String cat = worker['workerCategory'] ?? 'Worker';
          final num trust = worker['trustScore'] ?? 5.0;

          newMarkers.add(
            Marker(
              markerId: MarkerId(workerId),
              position: LatLng(lat, lng),
              infoWindow: InfoWindow(
                title: '$cat ⭐ ${trust.toStringAsFixed(1)}',
                snippet: 'Tap to view details & book',
                onTap: () => _showWorkerDetailsBottomSheet(workerId),
              ),
              onTap: () => _showWorkerDetailsBottomSheet(workerId),
            ),
          );
        }

        setState(() {
          _nearbyWorkers = workers;
          _markers = newMarkers;
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading map workers: $e')),
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

  Future<void> _showWorkerDetailsBottomSheet(String workerId) async {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) => _WorkerBottomSheetCard(workerId: workerId),
    );
  }

  @override
  Widget build(BuildContext context) {
    bool isSupportedPlatform = kIsWeb || Platform.isAndroid || Platform.isIOS;

    return Scaffold(
      backgroundColor: AppColors.surfaceOffWhite,
      appBar: AppBar(
        backgroundColor: AppColors.surfaceOffWhite,
        elevation: 0,
        title: Text(
          'Workforce Map',
          style: Theme.of(context).textTheme.headlineLarge,
        ),
        actions: [
          PopupMenuButton<String>(
            icon: const Icon(Icons.filter_list, color: AppColors.textPrimary),
            onSelected: (val) {
              setState(() {
                _selectedCategory = val;
              });
              _fetchWorkers();
            },
            itemBuilder: (context) => const [
              PopupMenuItem(value: 'ALL', child: Text('All Categories')),
              PopupMenuItem(value: 'MASON', child: Text('Masonry')),
              PopupMenuItem(value: 'LABOR', child: Text('General Labor')),
              PopupMenuItem(value: 'CARPENTER', child: Text('Carpentry')),
              PopupMenuItem(value: 'PAINTER', child: Text('Painting')),
            ],
          ),
          IconButton(
            icon: const Icon(Icons.refresh, color: AppColors.textPrimary),
            onPressed: _fetchWorkers,
          ),
        ],
      ),
      body: Stack(
        children: [
          isSupportedPlatform
              ? GoogleMap(
                  initialCameraPosition: CameraPosition(target: _userPosition, zoom: 12.0),
                  markers: _markers,
                  myLocationEnabled: true,
                  myLocationButtonEnabled: true,
                  compassEnabled: true,
                  onMapCreated: (ctrl) => _mapController = ctrl,
                )
              : _buildFallbackListView(),
          if (_isLoading)
            const Positioned(
              top: 16,
              left: 16,
              child: Card(
                child: Padding(
                  padding: EdgeInsets.all(8.0),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                      SizedBox(width: 8),
                      Text('Finding nearby workers...', style: TextStyle(fontSize: 12)),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildFallbackListView() {
    if (_nearbyWorkers.isEmpty) {
      return const Center(
        child: Text(
          'No available workers found nearby.',
          style: TextStyle(fontSize: 16, color: AppColors.textSecondary),
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _nearbyWorkers.length,
      itemBuilder: (context, index) {
        final worker = _nearbyWorkers[index];
        final String workerId = worker['workerId'];
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: AppColors.primaryLight,
              child: Text(
                (worker['workerCategory'] as String)[0],
                style: const TextStyle(color: AppColors.primary, fontWeight: FontWeight.bold),
              ),
            ),
            title: Text(worker['workerCategory'] ?? 'Worker'),
            subtitle: Text('Distance: ${worker['distanceMeters']}m | Trust: ⭐${worker['trustScore']}'),
            trailing: ElevatedButton(
              onPressed: () => _showWorkerDetailsBottomSheet(workerId),
              child: const Text('View'),
            ),
          ),
        );
      },
    );
  }
}

class _WorkerBottomSheetCard extends StatefulWidget {
  final String workerId;
  const _WorkerBottomSheetCard({required this.workerId});

  @override
  State<_WorkerBottomSheetCard> createState() => _WorkerBottomSheetCardState();
}

class _WorkerBottomSheetCardState extends State<_WorkerBottomSheetCard> {
  final ApiService _apiService = ApiService();
  Map<String, dynamic>? _workerCardData;
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _loadSummary();
  }

  Future<void> _loadSummary() async {
    try {
      final response = await _apiService.getWorkerMapSummary(widget.workerId);
      if (mounted && response['success'] == true) {
        setState(() {
          _workerCardData = response['mapSummaryCard'];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: const BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      padding: const EdgeInsets.all(24),
      child: _isLoading
          ? const SizedBox(
              height: 200,
              child: Center(child: CircularProgressIndicator()),
            )
          : Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                      color: AppColors.borderLight,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    CircleAvatar(
                      radius: 28,
                      backgroundColor: AppColors.primaryLight,
                      child: Icon(Icons.person, size: 32, color: AppColors.primary),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _workerCardData?['workerCategory'] ?? 'Daily Worker',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          if (_workerCardData?['workerSubCategory'] != null)
                            Text(
                              _workerCardData!['workerSubCategory'],
                              style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.textSecondary),
                            ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              const Icon(Icons.star, color: Colors.amber, size: 18),
                              const SizedBox(width: 4),
                              Text(
                                '${_workerCardData?['averageRating'] ?? 5.0}',
                                style: const TextStyle(fontWeight: FontWeight.bold),
                              ),
                              const SizedBox(width: 12),
                              const Icon(Icons.verified_user, color: AppColors.statusGreen, size: 18),
                              const SizedBox(width: 4),
                              const Text('Verified ID', style: TextStyle(color: AppColors.statusGreen, fontSize: 12)),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceAround,
                  children: [
                    _buildStatCol('Completed Shifts', '${_workerCardData?['totalCompletedShifts'] ?? 0}'),
                    _buildStatCol('Trust Score', '${_workerCardData?['trustScore'] ?? 5.0}'),
                    _buildStatCol('Total Reviews', '${_workerCardData?['totalRatingsCount'] ?? 0}'),
                  ],
                ),
                const SizedBox(height: 24),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.pop(context);
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (context) => CreateShiftScreen(targetWorkerId: widget.workerId),
                        ),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 16),
                    ),
                    child: const Text('Book This Worker'),
                  ),
                ),
              ],
            ),
    );
  }

  Widget _buildStatCol(String label, String value) {
    return Column(
      children: [
        Text(value, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: AppColors.primary)),
        const SizedBox(height: 4),
        Text(label, style: const TextStyle(fontSize: 12, color: AppColors.textSecondary)),
      ],
    );
  }
}
