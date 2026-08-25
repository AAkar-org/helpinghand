import 'dart:convert';
import 'dart:io';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  String get baseUrl {
    if (!Platform.isAndroid) {
      return 'http://localhost:3000/api';
    }
    return 'http://10.0.2.2:3000/api';
  }

  static const String keyEmployerId = 'employer_id';
  static const String keyPhoneNumber = 'phone_number';
  static const String keyFullName = 'full_name';
  static const String keyUpiId = 'upi_id';
  static const String keyIsLoggedIn = 'is_logged_in';

  Future<void> saveSession({
    required String employerId,
    required String phoneNumber,
    String? fullName,
    String? upiId,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(keyEmployerId, employerId);
    await prefs.setString(keyPhoneNumber, phoneNumber);
    if (fullName != null) await prefs.setString(keyFullName, fullName);
    if (upiId != null) await prefs.setString(keyUpiId, upiId);
    await prefs.setBool(keyIsLoggedIn, true);
  }

  Future<Map<String, String?>> getSession() async {
    final prefs = await SharedPreferences.getInstance();
    return {
      'employerId': prefs.getString(keyEmployerId),
      'phoneNumber': prefs.getString(keyPhoneNumber),
      'fullName': prefs.getString(keyFullName),
      'upiId': prefs.getString(keyUpiId),
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

  Future<Map<String, dynamic>> registerEmployer({
    required String phoneNumber,
    required String fullName,
    String? upiId,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/employer/register'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'phoneNumber': phoneNumber,
        'fullName': fullName,
        'upiId': upiId,
      }),
    );
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> findNearbyWorkers({
    required double lat,
    required double lng,
    double radiusKm = 5,
    String? category,
  }) async {
    final queryParams = <String, String>{
      'lat': lat.toString(),
      'lng': lng.toString(),
      'radiusKm': radiusKm.toString(),
    };
    if (category != null && category.isNotEmpty) {
      queryParams['category'] = category;
    }
    final uri = Uri.parse('$baseUrl/employer/nearby-workers').replace(queryParameters: queryParams);
    final response = await http.get(uri);
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> getWorkerMapSummary(String workerId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/employer/workers/$workerId/summary'),
    );
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> createShift({
    required String employerId,
    required String workerId,
    required double agreedDailyWage,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/employer/shifts/create'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'employerId': employerId,
        'workerId': workerId,
        'agreedDailyWage': agreedDailyWage,
      }),
    );
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> getEmployerShifts(String employerId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/employer/shifts/user/$employerId'),
    );
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> getShiftById(String shiftId) async {
    final response = await http.get(
      Uri.parse('$baseUrl/employer/shifts/$shiftId'),
    );
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> adjustShiftTiming({
    required String shiftId,
    String? startTime,
    String? endTime,
    double? workedHours,
    double? customWage,
    String? reason,
  }) async {
    final response = await http.patch(
      Uri.parse('$baseUrl/employer/shifts/$shiftId/adjust-timing'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'startTime': startTime,
        'endTime': endTime,
        'workedHours': workedHours,
        'customWage': customWage,
        'reason': reason,
      }),
    );
    return jsonDecode(response.body);
  }

  Future<Map<String, dynamic>> reconcileCash({
    required String shiftId,
    required double workerLat,
    required double workerLng,
    required double employerLat,
    required double employerLng,
    double? cashAmount,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/employer/shifts/$shiftId/reconcile-cash'),
      headers: {'Content-Type': 'application/json'},
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

  Future<Map<String, dynamic>> submitEmployerRating({
    required String shiftId,
    required String reviewerId,
    required String revieweeId,
    required double ratingStars,
    String? reviewComment,
  }) async {
    final response = await http.post(
      Uri.parse('$baseUrl/employer/ratings/submit'),
      headers: {'Content-Type': 'application/json'},
      body: jsonEncode({
        'shiftId': shiftId,
        'reviewerId': reviewerId,
        'revieweeId': revieweeId,
        'reviewerRole': 'employer',
        'ratingStars': ratingStars.toInt(),
        'reviewComment': reviewComment,
      }),
    );
    return jsonDecode(response.body);
  }
}
