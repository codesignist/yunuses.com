import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextVitals,
  // Next'in varsayılanları, artı .claude: içindeki çalışma kopyaları
  // projenin tamamını bir kez daha içeriyor.
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts", ".claude/**"]),
  {
    // react-hooks eklentisi yalnız bu uzantılarda tanımlı; .cjs dosyalarında kural bulunamıyor.
    files: ["**/*.{js,jsx,mjs,ts,tsx,mts,cts}"],
    rules: {
      "react/no-unescaped-entities": "off",
      // React Compiler kuralları uyarı olarak kalıyor; çalışan useEffect kodu yalnız lint için yeniden yazılmasın.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
    },
  },
]);
