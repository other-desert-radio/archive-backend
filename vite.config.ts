import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
	base: "/admin/",
	plugins: [react()],
	root: "src/admin-ui",
	build: {
		outDir: "../../dist/admin",
		emptyOutDir: true,
	},
});
