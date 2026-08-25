import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import '../theme/app_colors.dart';

import 'dart:io' show Platform;
import 'package:flutter/foundation.dart' show kIsWeb;

class MapScreen extends StatefulWidget {
  const MapScreen({super.key});

  @override
  State<MapScreen> createState() => _MapScreenState();
}

class _MapScreenState extends State<MapScreen> {
  // Initial camera position (e.g., city center)
  static const CameraPosition _initialPosition = CameraPosition(
    target: LatLng(28.6139, 77.2090), // New Delhi
    zoom: 12.0,
  );

  final Set<Marker> _markers = {
    const Marker(
      markerId: MarkerId('shift_1'),
      position: LatLng(28.6200, 77.2100),
      infoWindow: InfoWindow(title: 'Warehouse - 1 No-Show', snippet: 'Urgent Coverage Needed'),
    ),
    const Marker(
      markerId: MarkerId('shift_2'),
      position: LatLng(28.6300, 77.2200),
      infoWindow: InfoWindow(title: 'Delivery Hub', snippet: 'All staff checked in'),
    ),
    const Marker(
      markerId: MarkerId('worker_1'),
      position: LatLng(28.6150, 77.2050),
      infoWindow: InfoWindow(title: 'John D.', snippet: 'Delivery Driver (Active)'),
    ),
  };

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
      ),
      body: isSupportedPlatform 
          ? GoogleMap(
              initialCameraPosition: _initialPosition,
              markers: _markers,
              myLocationEnabled: true,
              myLocationButtonEnabled: true,
              compassEnabled: true,
            )
          : const Center(
              child: Text(
                'Map is only supported on Android, iOS, and Web.',
                style: TextStyle(fontSize: 16, color: AppColors.textSecondary),
              ),
            ),
    );
  }
}
