import 'package:flutter_test/flutter_test.dart';
import 'package:worker_app/main.dart';

void main() {
  testWidgets('WorkerApp smoke test', (WidgetTester tester) async {
    await tester.pumpWidget(const MyApp());
    expect(find.byType(MyApp), findsOneWidget);
  });
}
