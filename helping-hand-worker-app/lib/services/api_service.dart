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
  static const String keyEmail = 'email';
  static const String keyAvatarUrl = 'avatar_url';
  static const String keyToken = 'jwt_token';
  static const String keyRefreshToken = 'refresh_token';
  static const String keyIsLoggedIn = 'is_logged_in';

  // 1. Session Storage Helpers
  Future<void> saveSession({
    required String workerId,
    String? phoneNumber,
    String? category,
    String? subCategory,
    String? email,
    String? avatarUrl,
    String? token,
    String? refreshToken,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(keyWorkerId, workerId);
    if (phoneNumber != null) await prefs.setString(keyPhoneNumber, phoneNumber);
    if (category != null) await prefs.setString(keyCategory, category);
    if (subCategory != null) await prefs.setString(keySubCategory, subCategory);
    if (email != null) await prefs.setString(keyEmail, email);
    if (avatarUrl != null) await prefs.setString(keyAvatarUrl, avatarUrl);
    if (token != null) await prefs.setString(keyToken, token);
    if (refreshToken != null) await prefs.setString(keyRefreshToken, refreshToken);
    await prefs.setBool(keyIsLoggedIn, true);
  }

  Future<Map<String, String?>> getSession() async {
    final prefs = await SharedPreferences.getInstance();
    return {
      'workerId': prefs.getString(keyWorkerId),
      'phoneNumber': prefs.getString(keyPhoneNumber),
      'category': prefs.getString(keyCategory),
      'subCategory': prefs.getString(keySubCategory),
      'email': prefs.getString(keyEmail),
      'avatarUrl': prefs.getString(keyAvatarUrl),
      'token': prefs.getString(keyToken),
      'refreshToken': prefs.getString(keyRefreshToken),
    };
  }

  Future<String?> getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(keyToken);
  }

  Future<String?> getRefreshToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(keyRefreshToken);
  }

  Future<bool> isLoggedIn() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getBool(keyIsLoggedIn) ?? false;
  }

  Future<void> clearSession() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.clear();
  }

  Future<Map<String, String>> _getHeaders() async {
    final token = await getToken();
    return {
      'Content-Type': 'application/json',
      if (token != null && token.isNotEmpty) 'Authorization': 'Bearer $token',
    };
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

  Future<Map<String, dynamic>> googleAuth({
    required String idToken,
    String role = 'worker',
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/google'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'idToken': idToken, 'role': role}),
    );
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> refreshToken() async {
    final refToken = await getRefreshToken();
    if (refToken == null) {
      return {'success': false, 'error': 'No refresh token available'};
    }
    final response = await http.post(
      Uri.parse('$baseUrl/auth/refresh-token'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({'refreshToken': refToken}),
    );
    final data = jsonDecode(response.body);
    if (data['success'] == true && data['token'] != null) {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(keyToken, data['token']);
    }
    return data;
  }

  Future<Map<String, dynamic>> registerWorker({
    required String phoneNumber,
    required String workerCategory,
    String? workerSubCategory,
  }) async {
    final headers = await _getHeaders();
    final response = await http.post(
      Uri.parse('$baseUrl/worker/register'),
      headers: headers,
      body: jsonEncode({
        'phoneNumber': phoneNumber,
        'workerCategory': workerCategory,
        'workerSubCategory': workerSubCategory,
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
    final headers = await _getHeaders();
    final response = await http.post(
      Uri.parse('$baseUrl/worker/toggle-availability'),
      headers: headers,
      body: jsonEncode({
        'workerId': workerId,
        'isAvailable': isAvailable,
        'lat': lat,
        'lng': lng,
      }),
    );
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> updateLocation({
    required String workerId,
    required double lat,
    required double lng,
  }) async {
    final headers = await _getHeaders();
    final response = await http.post(
      Uri.parse('$baseUrl/worker/location'),
      headers: headers,
      body: jsonEncode({'workerId': workerId, 'lat': lat, 'lng': lng}),
    );
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> getWorkerStatus(String workerId) async {
    final headers = await _getHeaders();
    final response = await http.get(
      Uri.parse('$baseUrl/worker/status/$workerId'),
      headers: headers,
    );
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> getWorkerProfile(String workerId) async {
    final headers = await _getHeaders();
    final response = await http.get(
      Uri.parse('$baseUrl/worker/profile/$workerId'),
      headers: headers,
    );
    return jsonDecode(response.body);
  }

  // 4. Shift Management APIs
  Future<Map<String, dynamic>> getWorkerShifts(String workerId) async {
    final headers = await _getHeaders();
    final response = await http.get(
      Uri.parse('$baseUrl/worker/shifts/user/$workerId'),
      headers: headers,
    );
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> getShiftById(String shiftId) async {
    final headers = await _getHeaders();
    final response = await http.get(
      Uri.parse('$baseUrl/worker/shifts/$shiftId'),
      headers: headers,
    );
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> acceptShift(String shiftId) async {
    final headers = await _getHeaders();
    final response = await http.patch(
      Uri.parse('$baseUrl/worker/shifts/$shiftId/accept'),
      headers: headers,
    );
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> startShift(String shiftId) async {
    final headers = await _getHeaders();
    final response = await http.patch(
      Uri.parse('$baseUrl/worker/shifts/$shiftId/start'),
      headers: headers,
    );
    return jsonDecode(response.body);
  }

  // Two-Sided Physical Cash Handshake Initiation
  Future<Map<String, dynamic>> generateCashHandshakeCode({
    required String shiftId,
    required double lat,
    required double lng,
  }) async {
    final headers = await _getHeaders();
    final response = await http.post(
      Uri.parse('$baseUrl/worker/shifts/$shiftId/cash-handshake-code'),
      headers: headers,
      body: jsonEncode({'lat': lat, 'lng': lng}),
    );
    return jsonDecode(response.body);
  }

  // Backward-compatible cash reconcile
  Future<Map<String, dynamic>> reconcileCash({
    required String shiftId,
    required double workerLat,
    required double workerLng,
    required double employerLat,
    required double employerLng,
    required double cashAmount,
  }) async {
    final headers = await _getHeaders();
    final response = await http.post(
      Uri.parse('$baseUrl/worker/shifts/$shiftId/reconcile-cash'),
      headers: headers,
      body: jsonEncode({
        'workerLat': workerLat,
        'workerLng': workerLng,
        'employerLat': employerLat,
        'employerLng': employerLng,
        'cashAmount': cashAmount,
        'delayMinutes': 0,
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
    final headers = await _getHeaders();
    final response = await http.post(
      Uri.parse('$baseUrl/worker/ratings/submit'),
      headers: headers,
      body: jsonEncode({
        'shiftId': shiftId,
        'reviewerId': reviewerId,
        'revieweeId': revieweeId,
        'reviewerRole': 'worker',
        'ratingStars': ratingStars.toInt(),
        'reviewComment': reviewComment,
      }),
    );
    return jsonDecode(response.body);
  }
}
