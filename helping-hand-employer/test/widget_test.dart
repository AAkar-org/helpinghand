import 'package:flutter_test/flutter_test.dart';
import 'package:employer_app/main.dart';

void main() {
  testWidgets('EmployerApp smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const EmployerApp());
    expect(find.byType(EmployerApp), findsOneWidget);
  });
}
