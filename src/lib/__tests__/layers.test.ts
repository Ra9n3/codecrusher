import { describe, expect, it } from "vitest";
import {
  ALL_LAYERS,
  LAYER_PRESETS,
  LayerId,
  classifyLayer,
  encodeLayersParam,
  matchingLayerPreset,
  parseLayersParam,
  withLayersParam,
} from "../layers";

const cases: Array<[string, LayerId]> = [
  // 1. design-assets
  ["public/logo.png", "design-assets"],
  ["src/assets/icons/arrow.svg", "design-assets"],
  ["src/styles/theme.ts", "design-assets"],
  ["src/design-tokens/tokens.json", "design-assets"],
  ["public/fonts/Inter.woff2", "design-assets"],
  // 2. ui
  ["src/components/Button.tsx", "ui"],
  ["src/components/Table.tsx", "ui"],
  ["src/pages/Home.vue", "ui"],
  ["src/components/Button/Button.module.css", "ui"],
  ["src/index.css", "ui"],
  ["src/components/Button.stories.tsx", "ui"],
  ["src/app/page.tsx", "ui"],
  ["src/app/layout.tsx", "ui"],
  ["app/views/users/index.html.erb", "ui"],
  ["myapp/views.py", "ui"],
  ["src/App.tsx", "ui"],
  // 3. routing
  ["src/router/index.ts", "routing"],
  ["src/routes.tsx", "routing"],
  ["src/app.routes.ts", "routing"],
  ["config/routes.rb", "routing"],
  ["myapp/urls.py", "routing"],
  ["src/middleware.ts", "routing"],
  ["src/navigation/navLinks.ts", "routing"],
  // 4. state
  ["src/store/userSlice.ts", "state"],
  ["src/features/cart/cartSlice.ts", "state"],
  ["src/contexts/AuthContext.tsx", "state"],
  ["src/components/ThemeProvider.tsx", "state"],
  ["src/lib/queryClient.ts", "state"],
  ["src/stores/useCartStore.ts", "state"],
  // 5. business-logic
  ["src/services/payment.service.ts", "business-logic"],
  ["src/services/userService.ts", "business-logic"],
  ["app/services/payment_service.rb", "business-logic"],
  ["src/lib/utils.ts", "business-logic"],
  ["src/domain/order.ts", "business-logic"],
  ["src/hooks/useDebounce.ts", "business-logic"],
  ["src/lib/validators/email.ts", "business-logic"],
  ["cmd/server/main.go", "business-logic"],
  ["src/main.rs", "business-logic"],
  ["src/components/Form/validation.ts", "business-logic"],
  // 6. data-api
  ["src/api/users.ts", "data-api"],
  ["src/app/api/users/route.ts", "data-api"],
  ["src/pages/api/users.ts", "data-api"],
  ["src/lib/db.ts", "data-api"],
  ["src/lib/prisma.ts", "data-api"],
  ["prisma/schema.prisma", "data-api"],
  ["db/migrations/0001_init.sql", "data-api"],
  ["myapp/models.py", "data-api"],
  ["app/models/user.rb", "data-api"],
  ["src/hooks/useUsersQuery.ts", "data-api"],
  ["src/repositories/UserRepository.ts", "data-api"],
  ["internal/store/postgres.go", "data-api"],
  ["src/utils/api.ts", "data-api"],
  // 7. types-schemas
  ["src/types/api.ts", "types-schemas"],
  ["src/types.ts", "types-schemas"],
  ["src/user.types.ts", "types-schemas"],
  ["src/env.d.ts", "types-schemas"],
  ["proto/user.proto", "types-schemas"],
  ["graphql/schema.graphql", "types-schemas"],
  ["src/lib/validations/user.schema.ts", "types-schemas"],
  ["src/dto/CreateUserDto.ts", "types-schemas"],
  ["myapp/serializers.py", "types-schemas"],
  ["openapi.yaml", "types-schemas"],
  // 8. config-infra
  ["package.json", "config-infra"],
  ["package-lock.json", "config-infra"],
  ["tsconfig.json", "config-infra"],
  ["vite.config.ts", "config-infra"],
  ["Dockerfile", "config-infra"],
  ["docker-compose.yml", "config-infra"],
  [".github/workflows/ci.yml", "config-infra"],
  [".env.example", "config-infra"],
  ["tailwind.config.ts", "config-infra"],
  ["infra/main.tf", "config-infra"],
  ["myproject/settings.py", "config-infra"],
  ["src/config/index.ts", "config-infra"],
  ["src/env.ts", "config-infra"],
  ["public/robots.txt", "config-infra"],
  ["Makefile", "config-infra"],
  // 9. tests
  ["src/components/Button.test.tsx", "tests"],
  ["src/lib/__tests__/junk.test.ts", "tests"],
  ["tests/e2e/login.spec.ts", "tests"],
  ["cypress/e2e/login.cy.ts", "tests"],
  ["pkg/auth/auth_test.go", "tests"],
  ["tests/test_models.py", "tests"],
  ["spec/models/user_spec.rb", "tests"],
  ["src/__mocks__/axios.ts", "tests"],
  ["src/components/__snapshots__/Button.test.tsx.snap", "tests"],
  ["src/store/__tests__/userSlice.test.ts", "tests"],
  // 10. docs
  ["README.md", "docs"],
  ["README", "docs"],
  ["CHANGELOG.md", "docs"],
  ["LICENSE", "docs"],
  ["docs/adr/0001-record.md", "docs"],
  ["CONTRIBUTING.md", "docs"],
  // 11. tooling-scripts
  ["scripts/release.sh", "tooling-scripts"],
  ["scripts/generate-icons.ts", "tooling-scripts"],
  [".eslintrc.cjs", "tooling-scripts"],
  ["eslint.config.js", "tooling-scripts"],
  [".prettierrc", "tooling-scripts"],
  ["prisma/seed.ts", "tooling-scripts"],
  ["manage.py", "tooling-scripts"],
  ["tools/codegen/index.ts", "tooling-scripts"],
  ["data/sample-data.csv", "tooling-scripts"],
  // 12. i18n-content
  ["src/locales/en.json", "i18n-content"],
  ["src/i18n/de.ts", "i18n-content"],
  ["public/locales/fr/common.json", "i18n-content"],
  ["locale/messages.po", "i18n-content"],
  ["content/blog/hello.md", "i18n-content"],
  ["android/app/src/main/res/values/strings.xml", "i18n-content"],
  ["lib/l10n/app_en.arb", "i18n-content"],
];

describe("classifyLayer", () => {
  it.each(cases)("%s → %s", (path, expected) => {
    expect(classifyLayer({ path })).toBe(expected);
  });

  it("always returns exactly one known layer", () => {
    for (const p of ["weird.file", "noext", "deep/unknown/thing.xyz", "src/foo.ts", "a/b/c/d/e/f.json"]) {
      expect(ALL_LAYERS).toContain(classifyLayer({ path: p }));
    }
  });

  it("uses a JSX sniff only as a last resort", () => {
    expect(classifyLayer({ path: "src/foo.js", content: "export const X = () => <div className=\"a\" />" })).toBe("ui");
    expect(classifyLayer({ path: "src/foo.js", content: "export const x = 1" })).toBe("business-logic");
  });

  it("does not let generic container dirs (app/, features/) override name signals", () => {
    expect(classifyLayer({ path: "app/services/mailer_service.rb" })).toBe("business-logic");
    expect(classifyLayer({ path: "src/features/auth/auth.api.ts" })).toBe("data-api");
    expect(classifyLayer({ path: "src/features/auth/LoginForm.tsx" })).toBe("ui");
  });

  it("does not mistake auth tokens for design tokens", () => {
    expect(classifyLayer({ path: "src/auth/tokens.ts" })).toBe("business-logic");
  });
});

describe("layer presets", () => {
  it("ships the four spec presets", () => {
    const byId = Object.fromEntries(LAYER_PRESETS.map((p) => [p.id, p.layers]));
    expect(byId["ui-review"]).toEqual(["design-assets", "ui", "routing"]);
    expect(byId["architecture"]).toEqual(["state", "business-logic", "data-api", "types-schemas"]);
    expect(byId["backend"]).toEqual(["business-logic", "data-api", "types-schemas", "config-infra"]);
    expect(byId["no-tests"]).toHaveLength(11);
    expect(byId["no-tests"]).not.toContain("tests");
  });

  it("recognises a selection that equals a preset regardless of order", () => {
    expect(matchingLayerPreset(["routing", "ui", "design-assets"])).toBe("ui-review");
    expect(matchingLayerPreset(["ui"])).toBe("custom");
    expect(matchingLayerPreset(ALL_LAYERS)).toBe("all");
  });
});

describe("layers URL param", () => {
  it("round-trips through the query string", () => {
    const search = withLayersParam("?foo=1", ["ui", "routing", "state"]);
    expect(search).toBe("?foo=1&layers=ui%2Crouting%2Cstate");
    expect(parseLayersParam(search)).toEqual(["ui", "routing", "state"]);
  });

  it("omits the param when every layer is active", () => {
    expect(encodeLayersParam(ALL_LAYERS)).toBeNull();
    expect(withLayersParam("?layers=ui", ALL_LAYERS)).toBe("");
    expect(parseLayersParam("")).toEqual(ALL_LAYERS);
  });

  it("drops unknown ids and dedupes", () => {
    expect(parseLayersParam("?layers=ui,bogus,UI,tests")).toEqual(["ui", "tests"]);
    expect(parseLayersParam("?layers=bogus")).toEqual(ALL_LAYERS);
  });

  it("emits ids in canonical layer order", () => {
    expect(encodeLayersParam(["tests", "ui", "design-assets"])).toBe("design-assets,ui,tests");
  });
});
