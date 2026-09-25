// Initialize before application imports; never use the developer's database in unit tests.
process.env.NODE_ENV = "test";
process.env.DATABASE_URL =
	"postgres://auth-test:auth-test@127.0.0.1:1/auth-test";
process.env.BETTER_AUTH_SECRET =
	"unit-tests-only-secret-at-least-32-characters";
process.env.BETTER_AUTH_URL = "http://localhost:3000";
process.env.ADMIN_BASIC_USERNAME = "";
process.env.ADMIN_BASIC_PASSWORD = "";
