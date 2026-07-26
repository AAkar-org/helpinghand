# Root Architecture Rules for Antigravity Agents
1. **Strict Isolation:** Agents operating in frontend folders must NEVER modify files in `/workforce-os-core-api`.
2. **Tech Stack Enforcement:**
   - Employer App: Flutter/Dart.
   - Worker App: Flutter/Dart (with Geolocation & Audio focus).
   - Core API: Node.js, Express, PostgreSQL, Redis.
3. **Execution Limit:** Always ask for user confirmation before running database migrations or installing heavy dependencies.
