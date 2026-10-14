import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    languageOptions: {
      parserOptions: {
        sourceType: "module",
        ecmaVersion: "latest",
      }
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: [
                "@/features/compatibility/legacy-api",
                "**/features/compatibility/legacy-api",
              ],
              message: "Legacy API contracts are quarantined and must not gain runtime call sites.",
            },
          ],
        },
      ],
    },
  },
  {
    files: [
      "src/app/(admin)/**/*.{ts,tsx}",
      "src/features/accounts/**/*.{ts,tsx}",
      "src/features/content/**/*.{ts,tsx}",
      "src/features/system/**/*.{ts,tsx}",
      "src/features/team/**/*.{ts,tsx}",
      "src/features/website/**/*.{ts,tsx}",
      "src/features/workspaces/**/*.{ts,tsx}",
    ],
    rules: {
      "no-console": "error",
      "no-restricted-globals": [
        "error",
        { name: "alert", message: "Admin phải hiển thị phản hồi bằng giao diện." },
        { name: "prompt", message: "Admin phải dùng hộp thoại nhập lý do." },
        { name: "confirm", message: "Admin phải dùng hộp thoại xác nhận." },
      ],
      "no-restricted-properties": [
        "error",
        { object: "window", property: "alert", message: "Admin ph?i hi?n th? ph?n h?i b?ng giao di?n." },
        { object: "window", property: "prompt", message: "Admin ph?i d?ng reason dialog." },
        { object: "window", property: "confirm", message: "Admin ph?i d?ng modal x?c nh?n." },
      ],
    },
  },
  // Workspace CMS payloads are schemaless JSON while the API contract is being
  // generated. Keep this exception local; typecheck and tests still cover the
  // module, and no other feature may introduce explicit `any`.
  {
    files: [
      "src/features/workspaces/**/*.{ts,tsx}",
      "src/app/(client)/dich-vu-cho-thue/office/**/page.tsx",
    ],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "react-hooks/set-state-in-effect": "off",
      "react-hooks/exhaustive-deps": "off",
      "@next/next/no-img-element": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "test.ts",
  ]),
]);

export default eslintConfig;
