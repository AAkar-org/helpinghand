import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  // Dynamic base URL targeting host machine from Android/iOS/Web
  String get baseUrl {
    if (!Platform.isAndroid) {
      return 'http://localhost:3000/api';
    }
    return 'http://10.0.2.2:3000/api';
  }

  // Session keys
  static const String keyWorkerId = 'worker_id';
  static const String keyPhoneNumber = 'phone_number';
  static const String keyCategory = 'worker_category';
  static const String keySubCategory = 'worker_sub_category';
  static const String keyIsLoggedIn = 'is_logged_in';

  // 1. Session Storage Helpers
  Future<void> saveSession({
    required String workerId,
    required String phoneNumber,
    String? category,
    String? subCategory,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(keyWorkerId, workerId);
    await prefs.setString(keyPhoneNumber, phoneNumber);
    if (category != null) await prefs.setString(keyCategory, category);
    if (subCategory != null) await prefs.setString(keySubCategory, subCategory);
    await prefs.setBool(keyIsLoggedIn, true);
  }

  Future<Map<String, String?>> getSession() async {
    final prefs = await SharedPreferences.getInstance();
    return {
      'workerId': prefs.getString(keyWorkerId),
      'phoneNumber': prefs.getString(keyPhoneNumber),
      'category': prefs.getString(keyCategory),
      'subCategory': prefs.getString(keySubCategory),
    };
  }

  Future<bool> isLoggedIn() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(keyIsLoggedIn) ?? false;
  }

  Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
  }

  // 2. Auth APIs
  Future<Map<String, dynamic>> sendOtp(String phoneNumber) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/send-otp'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'phoneNumber': phoneNumber}),
    );
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> verifyOtp(String phoneNumber, String otp) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/verify-otp'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'phoneNumber': phoneNumber, 'otp': otp}),
    );
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> registerWorker({
    required String phoneNumber,
    required String workerCategory,
    String? workerSubCategory,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/worker/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'phoneNumber': phoneNumber,
        'workerCategory': workerCategory,
        'workerSubCategory': ?workerSubCategory,
      }),
    );
    return jsonDecode(response.body);
  }

  // 3. Worker Status / Location APIs
  Future<Map<String, dynamic>> toggleAvailability({
    required String workerId,
    required bool isAvailable,
    double? lat,
    double? lng,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/worker/toggle-availability'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'workerId': workerId,
        'isAvailable': isAvailable,
        'lat': ?lat,
        'lng': ?lng,
      }),
    );
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> updateLocation({
    required String workerId,
    required double lat,
    required double lng,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/worker/location'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'workerId': workerId, 'lat': lat, 'lng': lng}),
    );
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> getWorkerStatus(String workerId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/worker/status/$workerId'),
    );
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> getWorkerProfile(String workerId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/worker/profile/$workerId'),
    );
    return jsonDecode(response.body);
  }

  // 4. Shift Management APIs
  Future<Map<String, dynamic>> getWorkerShifts(String workerId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/worker/shifts/user/$workerId'),
    );
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> getShiftById(String shiftId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/worker/shifts/$shiftId'),
    );
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> acceptShift(String shiftId) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/worker/shifts/$shiftId/accept'),
    );
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> startShift(String shiftId) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/worker/shifts/$shiftId/start'),
    );
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> reconcileCash({
    required String shiftId,
    required double workerLat,
    required double workerLng,
    required double employerLat,
    required double employerLng,
    required double cashAmount,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/worker/shifts/$shiftId/reconcile-cash'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'workerLat': workerLat,
        'workerLng': workerLng,
        'employerLat': employerLat,
        'employerLng': employerLng,
        'cashAmount': cashAmount,
        'delayMinutes': 0, // Instant callback test for worker convenience
        'isSyncTest': true,
      }),
    );
    return jsonDecode(response.body);
  }

  // 5. Ratings API
  Future<Map<String, dynamic>> submitWorkerRating({
    required String shiftId,
    required String reviewerId,
    required String revieweeId,
    required double ratingStars,
    String? reviewComment,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/worker/ratings/submit'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'shiftId': shiftId,
        'reviewerId': reviewerId,
        'revieweeId': revieweeId,
        'reviewerRole': 'worker',
        'ratingStars': ratingStars.toInt(),
        'reviewComment': ?reviewComment,
      }),
    );
    return jsonDecode(response.body);
  }
}
