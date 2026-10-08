/**
 * Layer classification: every file gets exactly one best-fit layer based on
 * path + filename + extension heuristics (no AST). Users can override per file.
 */

export type LayerId =
  | "design-assets"
  | "ui"
  | "routing"
  | "state"
  | "business-logic"
  | "data-api"
  | "types-schemas"
  | "config-infra"
  | "tests"
  | "docs"
  | "tooling-scripts"
  | "i18n-content";

export interface LayerMeta {
  id: LayerId;
  /** 1 = most user-facing … 12 = infrastructure / content. */
  order: number;
  label: string;
  short: string;
  hint: string;
  dot: string;
  chip: string;
  badge: string;
}

export const LAYERS: LayerMeta[] = [
  { id: "design-assets", order: 1, label: "Design assets", short: "assets", hint: "Design tokens, themes, fonts, icons, images, SVGs", dot: "bg-pink-400", chip: "border-pink-400/40 bg-pink-400/10 text-pink-200", badge: "bg-pink-400/15 text-pink-300" },
  { id: "ui", order: 2, label: "UI", short: "ui", hint: "Components, pages, layouts, CSS, stories", dot: "bg-rose-400", chip: "border-rose-400/40 bg-rose-400/10 text-rose-200", badge: "bg-rose-400/15 text-rose-300" },
  { id: "routing", order: 3, label: "Routing", short: "routing", hint: "Route definitions, nav menus, URL middleware", dot: "bg-orange-400", chip: "border-orange-400/40 bg-orange-400/10 text-orange-200", badge: "bg-orange-400/15 text-orange-300" },
  { id: "state", order: 4, label: "State", short: "state", hint: "Stores, reducers, contexts, cache logic", dot: "bg-amber-400", chip: "border-amber-400/40 bg-amber-400/10 text-amber-200", badge: "bg-amber-400/15 text-amber-300" },
  { id: "business-logic", order: 5, label: "Business logic", short: "logic", hint: "Services, use-cases, domain models, validators", dot: "bg-yellow-300", chip: "border-yellow-300/40 bg-yellow-300/10 text-yellow-100", badge: "bg-yellow-300/15 text-yellow-200" },
  { id: "data-api", order: 6, label: "Data / API", short: "data", hint: "API clients, repositories, queries, migrations, ORM", dot: "bg-sky-400", chip: "border-sky-400/40 bg-sky-400/10 text-sky-200", badge: "bg-sky-400/15 text-sky-300" },
  { id: "types-schemas", order: 7, label: "Types & schemas", short: "types", hint: "Interfaces, type defs, zod schemas, DTOs, proto/graphql", dot: "bg-indigo-400", chip: "border-indigo-400/40 bg-indigo-400/10 text-indigo-200", badge: "bg-indigo-400/15 text-indigo-300" },
  { id: "config-infra", order: 8, label: "Config & infra", short: "config", hint: "Env examples, config, Docker, CI/CD, manifests", dot: "bg-zinc-300", chip: "border-zinc-500/50 bg-zinc-700/40 text-zinc-200", badge: "bg-zinc-500/20 text-zinc-300" },
  { id: "tests", order: 9, label: "Tests", short: "tests", hint: "Unit/integration/e2e tests, fixtures, mocks", dot: "bg-emerald-400", chip: "border-emerald-400/40 bg-emerald-400/10 text-emerald-200", badge: "bg-emerald-400/15 text-emerald-300" },
  { id: "docs", order: 10, label: "Docs", short: "docs", hint: "READMEs, ADRs, docs/, changelog", dot: "bg-teal-400", chip: "border-teal-400/40 bg-teal-400/10 text-teal-200", badge: "bg-teal-400/15 text-teal-300" },
  { id: "tooling-scripts", order: 11, label: "Tooling & scripts", short: "tooling", hint: "One-off scripts, codegen, lint config, seed data", dot: "bg-violet-400", chip: "border-violet-400/40 bg-violet-400/10 text-violet-200", badge: "bg-violet-400/15 text-violet-300" },
  { id: "i18n-content", order: 12, label: "i18n & content", short: "i18n", hint: "Translations, CMS content, copy", dot: "bg-fuchsia-400", chip: "border-fuchsia-400/40 bg-fuchsia-400/10 text-fuchsia-200", badge: "bg-fuchsia-400/15 text-fuchsia-300" },
];

export const ALL_LAYERS: LayerId[] = LAYERS.map((l) => l.id);
const LAYER_SET = new Set<string>(ALL_LAYERS);

export function layerMeta(id: LayerId): LayerMeta {
  return LAYERS.find((l) => l.id === id) ?? LAYERS[4];
}

export function isLayerId(v: string): v is LayerId {
  return LAYER_SET.has(v);
}

export function layerOrder(a: LayerId, b: LayerId): number {
  return layerMeta(a).order - layerMeta(b).order;
}

export interface LayerPreset {
  id: string;
  name: string;
  hint: string;
  layers: LayerId[];
}

export const LAYER_PRESETS: LayerPreset[] = [
  { id: "all", name: "All layers", hint: "No layer filter", layers: ALL_LAYERS },
  { id: "ui-review", name: "UI review", hint: "Design assets · UI · Routing", layers: ["design-assets", "ui", "routing"] },
  { id: "architecture", name: "Architecture", hint: "State · Business logic · Data/API · Types", layers: ["state", "business-logic", "data-api", "types-schemas"] },
  { id: "backend", name: "Backend deep-dive", hint: "Business logic · Data/API · Types · Config", layers: ["business-logic", "data-api", "types-schemas", "config-infra"] },
  { id: "no-tests", name: "Everything but tests", hint: "All layers except tests", layers: ALL_LAYERS.filter((l) => l !== "tests") },
];

export function matchingLayerPreset(layers: readonly LayerId[]): string {
  const set = new Set(layers);
  for (const p of LAYER_PRESETS) {
    if (p.layers.length === set.size && p.layers.every((l) => set.has(l))) return p.id;
  }
  return "custom";
}

// ---------- URL encoding ----------

export const LAYERS_PARAM = "layers";

/** `?layers=ui,routing` → ["ui","routing"]; unknown ids are dropped; absent/empty → all layers. */
export function parseLayersParam(search: string): LayerId[] {
  const params = new URLSearchParams(search.startsWith("?") ? search : `?${search}`);
  const raw = params.get(LAYERS_PARAM);
  if (raw === null) return [...ALL_LAYERS];
  const ids = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(isLayerId);
  const unique = [...new Set(ids)];
  return unique.length ? unique : [...ALL_LAYERS];
}

/** Returns the `layers` param value, or null when all layers are active (param omitted). */
export function encodeLayersParam(layers: readonly LayerId[]): string | null {
  const set = new Set(layers);
  if (set.size >= ALL_LAYERS.length) return null;
  return ALL_LAYERS.filter((l) => set.has(l)).join(",");
}

/** Rewrites `search` with the given layer selection, preserving other params. */
export function withLayersParam(search: string, layers: readonly LayerId[]): string {
  const params = new URLSearchParams(search);
  const value = encodeLayersParam(layers);
  if (value === null) params.delete(LAYERS_PARAM);
  else params.set(LAYERS_PARAM, value);
  const s = params.toString();
  return s ? `?${s}` : "";
}

// ---------- Classification ----------

const IMAGE_FONT_EXT = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "ico", "icns", "tiff", "heic", "svg",
  "woff", "woff2", "ttf", "otf", "eot",
  "mp3", "wav", "ogg", "mp4", "webm", "mov",
  "psd", "ai", "sketch", "fig", "xd", "lottie",
]);
const DOC_EXT = new Set(["md", "mdx", "rst", "adoc", "asciidoc", "txt", "rtf", "pdf"]);
const STYLE_EXT = new Set(["css", "scss", "sass", "less", "styl", "pcss"]);
const MARKUP_EXT = new Set(["html", "htm", "vue", "svelte", "astro", "hbs", "handlebars", "ejs", "pug", "jade", "njk", "liquid", "erb", "haml", "slim", "twig", "blade.php", "xaml", "storyboard", "xib", "qml", "fxml"]);
const JSX_EXT = new Set(["tsx", "jsx"]);
const JS_EXT = new Set(["ts", "tsx", "js", "jsx", "mjs", "cjs", "mts", "cts"]);
const BACKEND_EXT = new Set(["py", "go", "rs", "java", "kt", "kts", "rb", "php", "cs", "fs", "scala", "ex", "exs", "erl", "clj", "hs", "ml"]);
const CODE_EXT = new Set([
  ...JS_EXT, ...BACKEND_EXT,
  "swift", "c", "cc", "cpp", "h", "hpp", "m", "mm", "dart", "lua", "r", "jl", "zig", "nim", "vb", "groovy",
]);
const DATA_EXT = new Set(["json", "json5", "jsonc", "yaml", "yml", "toml", "ini", "xml", "plist", "properties", "cfg", "conf"]);

const ASSET_DIRS = new Set(["icons", "icon", "fonts", "font", "images", "image", "img", "imgs", "media", "design-tokens", "tokens", "theme", "themes", "brand", "logos", "illustrations", "svg", "svgs"]);
const TEST_DIRS = new Set(["test", "tests", "__tests__", "spec", "specs", "e2e", "cypress", "playwright", "__mocks__", "mocks", "fixtures", "__fixtures__", "__snapshots__", "testing", "integration-tests", "test-utils", "testutils"]);
const DOC_DIRS = new Set(["docs", "doc", "documentation", "adr", "adrs", "rfcs", "rfc", "wiki", "guides", "guide"]);
const I18N_DIRS = new Set(["locales", "locale", "i18n", "translations", "translation", "lang", "langs", "languages", "intl", "l10n", "content", "cms"]);
const TOOLING_DIRS = new Set(["scripts", "script", "tools", "tool", "bin", "codegen", "generators", "seeds", "seed", "seeders", ".husky", "hack", "ci-scripts", "devtools", "dev-tools"]);
const CONFIG_DIRS = new Set([".github", ".gitlab", ".circleci", ".buildkite", "ci", ".ci", "k8s", "kubernetes", "helm", "charts", "terraform", "infra", "infrastructure", "deploy", "deployment", "deployments", "docker", ".docker", "config", "configs", "nginx", ".storybook", ".devcontainer", "ansible", "cloudformation", "pulumi", "manifests", "env", "environments"]);

type DirKind = "types" | "routing" | "state" | "data" | "ui" | "logic";
const TYPES_DIRS = new Set(["types", "@types", "typings", "interfaces", "schemas", "schema", "dto", "dtos", "proto", "protos", "protobuf", "contracts", "definitions"]);
const ROUTING_DIRS = new Set(["routes", "route", "router", "routers", "routing", "navigation", "nav"]);
const STATE_DIRS = new Set(["store", "stores", "state", "redux", "slices", "slice", "reducers", "reducer", "actions", "selectors", "contexts", "context", "providers", "atoms", "recoil", "zustand", "pinia", "vuex", "mobx", "signals", "cache", "ngrx", "bloc", "blocs", "cubit", "cubits"]);
const DATA_DIRS = new Set(["api", "apis", "repositories", "repository", "repos", "queries", "query", "mutations", "migrations", "migration", "migrate", "models", "model", "entities", "entity", "prisma", "db", "database", "dao", "daos", "orm", "sql", "graphql", "gql", "resolvers", "controllers", "controller", "handlers", "endpoints", "endpoint", "clients", "fetchers", "datasources", "data-sources", "adapters", "gateways", "supabase", "firebase", "drizzle", "sequelize", "typeorm", "mongoose", "knex", "mailers", "serializers"]);
const UI_DIRS = new Set(["components", "component", "pages", "page", "views", "view", "layouts", "layout", "ui", "screens", "screen", "widgets", "widget", "templates", "template", "partials", "styles", "style", "stylesheets", "css", "scss", "sass", "app", "features", "feature", "modules", "containers", "elements", "primitives", "blocks", "sections", "storybook", "stories", "forms", "dialogs", "modals"]);
const LOGIC_DIRS = new Set(["services", "service", "usecases", "use-cases", "use_cases", "domain", "core", "lib", "libs", "utils", "util", "helpers", "helper", "validators", "validation", "validations", "logic", "engine", "engines", "workers", "worker", "jobs", "job", "commands", "command", "pipelines", "processors", "algorithms", "calc", "calculations", "rules", "policies", "hooks", "composables", "middleware", "middlewares", "interactors", "application", "business", "managers", "shared", "common", "internal", "pkg", "cmd", "server", "backend"]);

function dirKind(d: string): DirKind | null {
  if (TYPES_DIRS.has(d)) return "types";
  if (ROUTING_DIRS.has(d)) return "routing";
  if (STATE_DIRS.has(d)) return "state";
  if (DATA_DIRS.has(d)) return "data";
  if (UI_DIRS.has(d)) return "ui";
  if (LOGIC_DIRS.has(d)) return "logic";
  return null;
}

const LOCKFILE_NAMES = new Set(["package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb", "bun.lock", "cargo.lock", "gemfile.lock", "poetry.lock", "pipfile.lock", "uv.lock", "composer.lock", "go.sum", "pubspec.lock", "mix.lock", "flake.lock", "podfile.lock", "npm-shrinkwrap.json", "pdm.lock"]);
const MANIFEST_NAMES = new Set([
  "package.json", "cargo.toml", "go.mod", "pyproject.toml", "setup.py", "setup.cfg", "requirements.txt", "requirements-dev.txt", "pipfile", "gemfile", "composer.json", "pubspec.yaml", "mix.exs", "build.gradle", "build.gradle.kts", "settings.gradle", "settings.gradle.kts", "pom.xml", "podfile", "cartfile", "deno.json", "deno.jsonc", "bunfig.toml", "lerna.json", "nx.json", "turbo.json", "pnpm-workspace.yaml", "rush.json", "workspace.json", "project.json", "app.json", "expo.json",
  "manifest.json", "manifest.webmanifest", "site.webmanifest", "browserconfig.xml", "robots.txt", "sitemap.xml", "_redirects", "_headers", "cname", "vercel.json", "netlify.toml", "fly.toml", "render.yaml", "railway.json", "railway.toml", "procfile", "app.yaml", "serverless.yml", "serverless.yaml", "now.json", "wrangler.toml", "wrangler.json", "firebase.json", ".firebaserc", "amplify.yml", "heroku.yml", "codeowners",
  ".gitignore", ".gitattributes", ".gitmodules", ".dockerignore", ".npmignore", ".npmrc", ".nvmrc", ".node-version", ".python-version", ".ruby-version", ".tool-versions", ".yarnrc", ".yarnrc.yml", ".browserslistrc", "browserslist", "global.json", "nuget.config", "directory.build.props", "makefile", "cmakelists.txt", "justfile", "taskfile.yml", "taskfile.yaml", "vagrantfile", "skaffold.yaml",
  "tsconfig.json", "jsconfig.json", "babel.config.js", "babel.config.json", ".babelrc", "web.config", "nginx.conf", "settings.py", "wsgi.py", "asgi.py", "gunicorn.conf.py", "alembic.ini", "tox.ini", "pytest.ini", "mypy.ini", ".coveragerc", "codecov.yml", ".codecov.yml", "renovate.json", ".renovaterc", "dependabot.yml", ".releaserc", "release.config.js", ".travis.yml", "appveyor.yml", "azure-pipelines.yml", "bitbucket-pipelines.yml", "jenkinsfile", ".gitlab-ci.yml", "cloudbuild.yaml", "buildspec.yml",
  "angular.json", "nuxt.config.ts", "nuxt.config.js", "next.config.js", "next.config.mjs", "next.config.ts", "svelte.config.js", "astro.config.mjs", "astro.config.ts", "remix.config.js", "gatsby-config.js", "vue.config.js", "quasar.config.js", "capacitor.config.ts", "capacitor.config.json", "ionic.config.json", "metro.config.js", "react-native.config.js", "tailwind.config.js", "tailwind.config.ts", "tailwind.config.cjs", "tailwind.config.mjs", "postcss.config.js", "postcss.config.cjs", "postcss.config.mjs", "vite.config.ts", "vite.config.js", "vite.config.mts", "vitest.config.ts", "vitest.config.mts", "jest.config.js", "jest.config.ts", "jest.config.cjs", "jest.config.mjs", "playwright.config.ts", "cypress.config.ts", "cypress.config.js", "webpack.config.js", "webpack.config.ts", "rollup.config.js", "rollup.config.mjs", "rollup.config.ts", "esbuild.config.js", "tsup.config.ts", "snowpack.config.js", "parcel.config.json", ".parcelrc", "components.json", "drizzle.config.ts", "orval.config.ts", "codegen.yml", "codegen.ts", "codegen.yaml", "sentry.properties", "sentry.client.config.ts", "sentry.server.config.ts", "sentry.edge.config.ts", "instrumentation.ts",
]);
const LINT_NAMES = /^(\.eslintrc(\..+)?|eslint\.config\.[cm]?[jt]s|\.prettierrc(\..+)?|prettier\.config\.[cm]?[jt]s|\.prettierignore|\.eslintignore|\.stylelintrc(\..+)?|stylelint\.config\.[cm]?js|commitlint\.config\.[cm]?[jt]s|\.commitlintrc(\..+)?|lint-staged\.config\.[cm]?js|\.lintstagedrc(\..+)?|biome\.jsonc?|\.oxlintrc\.json|rome\.json|\.flake8|\.pylintrc|ruff\.toml|\.ruff\.toml|\.rubocop\.yml|\.golangci\.ya?ml|\.markdownlint(\..+)?|\.htmlhintrc|\.editorconfig|\.swiftlint\.yml|detekt\.yml|checkstyle\.xml|\.clang-format|\.clang-tidy|rustfmt\.toml|\.rustfmt\.toml|clippy\.toml|\.hadolint\.yaml|\.pre-commit-config\.yaml|\.secretlintrc\.json|\.ls-lint\.yml|\.cspell\.json|cspell\.json|\.jscpd\.json|\.size-limit\.json|dangerfile\.[jt]s|gulpfile\.[cm]?[jt]s|gruntfile\.[cm]?js|rakefile|fastfile|appfile|matchfile)$/i;

const TEST_NAME = /(\.|_|-)(test|spec|e2e|cy|stories\.test)\.[a-z0-9]+$|^test_.*\.py$|_test\.(go|rs|py|rb|ex|exs|dart|php|cs|java|kt|swift)$|_spec\.rb$|^conftest\.py$|^tests?\.py$|^(jest|vitest)\.setup\.[cm]?[jt]sx?$|^setup-?tests?\.[cm]?[jt]sx?$|^test-?utils?\.[cm]?[jt]sx?$|^test-?helpers?\.[cm]?[jt]sx?$|\.snap$|Tests?\.(cs|java|kt|swift|m|mm)$|Spec\.(scala|kt|groovy)$/i;
const STORY_NAME = /\.stor(y|ies)\.(mdx|[cm]?[jt]sx?)$/i;
const DOC_NAME = /^(readme|changelog|changes|history|contributing|contributors|code_of_conduct|code-of-conduct|security|support|authors|maintainers|roadmap|todo|faq|install|usage|upgrading|upgrade|migration-guide|backers|sponsors|acknowledgements|governance|citation|releases?|release-notes|notes|license|licence|copying|notice|patents)(\..+)?$/i;
const THEME_NAME = /(^|[._-])(theme|themes|design-?tokens|palette|colou?rs|typography|breakpoints|styleguide|style-?guide|brand)([._-]|$)|\.tokens\.json$/i;
const TOKENS_NAME = /(^|[._-])tokens([._-]|$)/i;
const NOT_DESIGN_CONTEXT = /(^|\/)(auth|session|sessions|jwt|oauth|security|api|crypto|tokenizer|lexer|parser|compiler)(\/|$)/i;
const I18N_FILE = /\.(po|pot|arb|xlf|xliff|resx|strings|tmx)$|^(strings\.xml|localizable\.strings)$|^(i18n|intl|l10n)\.[cm]?[jt]s$/i;
const LOCALE_FILE = /^([a-z]{2,3}([-_][a-z]{2,4})?)\.(json|ya?ml|ts|js|properties|toml|xml)$|^messages(\.[a-z-]+)?\.(json|xlf|properties|ts|js)$|^translations?(\.[a-z-]+)?\.(json|ts|js|ya?ml)$|^(copy|microcopy|locale|locales|i18n|intl|l10n)\.(json|ts|js|ya?ml)$/i;
// Lowercase patterns are tested against the lowercased name; CAMEL patterns against the original name.
const TYPES_NAME = /(^|[._-])(types?|typings|interfaces?|dtos?|enums?|contracts?|definitions?)\.[cm]?[jt]sx?$|\.d\.[cm]?ts$|\.(proto|graphql|graphqls|gql|avsc|thrift|fbs|xsd|wsdl)$|^openapi\.(json|ya?ml)$|^swagger\.(json|ya?ml)$|^schema\.(json|ya?ml|graphql|gql|ts|js|py|rb|sql)$|\.schema\.(ts|js|py|json|ya?ml)$|^serializers?\.py$|^schemas?\.py$|^dto\.(py|go|rs|java|kt|cs)$|^types?\.(py|go|rs|java|kt|cs|swift|dart)$|\.types\.(py|go|rs)$|^(interfaces?|protocols?)\.(py|go|swift)$|^zod\.[cm]?[jt]s$|\.zod\.[cm]?[jt]s$|\.valibot\.[cm]?[jt]s$|\.dto\.[cm]?[jt]s$/;
const TYPES_CAMEL = /[a-z0-9](Dto|DTO|Schema|Types|Interface|Interfaces)\.[cm]?[jt]s$/;
const ROUTING_NAME_STRONG = /^(routes?|router|routers|routing|app-?routes|app\.routes|route-?config|route-?map|route-?tree|routetree|sitemap|navigation)\.[cm]?[jt]sx?$|[._-](routes?|router|routing)\.[cm]?[jt]sx?$|routing\.module\.ts$|^urls\.py$|^routes\.(rb|php|py|go|rs|ex|kt|java|cs)$|^router\.(py|go|rs|ex|php|kt)$|^sitemap\.(ts|js|py|rb)$|^(web|api|console|channels)\.php$|^\+page\.(server\.)?[jt]s$|^\+layout\.(server\.)?[jt]s$/i;
const ROUTING_NAME_WEAK = /^(nav|nav-?links|nav-?items|nav-?config|menu|menus|menu-?items|menu-?config|paths|urls|url-?map|links|breadcrumbs?)\.[cm]?[jt]s$|[._-](nav|navigation|menu|sitemap|paths)\.[cm]?[jt]s$/i;
const STATE_NAME = /(^|[._-])(store|stores|slice|slices|reducer|reducers|actions?|selectors?|context|contexts|provider|providers|atom|atoms|signals?|state|states|machine|machines|statechart|cache|query-?client|queryclient|mobx|vuex|pinia|zustand|recoil|jotai|redux|bloc|cubit|notifier|viewmodel|view-?model)\.[cm]?[jt]sx?$|(^|[._-])(store|state|bloc|cubit|notifier|viewmodel|view_model|provider)\.(dart|kt|swift|py|rb|go|rs)$/;
const STATE_CAMEL = /[a-z0-9](Store|Slice|Reducer|Context|Provider|Providers|Atom|Machine|Bloc|Cubit|Notifier|ViewModel|State)\.[cm]?[jt]sx?$/;
const DATA_HOOK_NAME = /^use[A-Z]\w*(Query|Queries|Mutation|Mutations|Fetch|Api|Request|Infinite|Suspense|Swr|SWR)\.[cm]?[jt]sx?$|^use-[a-z-]*(query|mutation|fetch|api|swr)[a-z-]*\.[cm]?[jt]sx?$/;
const DATA_NAME = /(^|[._-])(api|apis|client|clients|http|fetch|fetcher|fetchers|axios|ky|graphql-?client|apollo|urql|trpc|repository|repositories|repo|repos|dao|query|queries|mutation|mutations|migration|migrations|model|models|entity|entities|db|database|datasource|data-?source|adapter|adapters|gateway|gateways|endpoint|endpoints|resolver|resolvers|controller|controllers|supabase|firebase|firestore|prisma|drizzle|sequelize|typeorm|mongoose|knex|sqlite|redis|kafka|crud|grpc|webhook|webhooks|request|requests|sdk|connection|pool)\.[cm]?[jt]sx?$|(^|[._-])(models?|entity|entities|repository|repositories|repo|dao|queries|query|migrations?|api|client|handlers?|controllers?|endpoints?|resolvers?|db|database|admin|managers|querysets|mailer|mailers|schema\.sql|seed\.sql)\.(py|go|rs|rb|php|java|kt|cs|swift|dart|ex|exs|scala)$|\.(sql|prisma|hql|cql)$/;
const DATA_CAMEL = /[a-z0-9](Api|Client|Repository|Repo|Query|Queries|Mutation|Mutations|Resolver|Controller|Gateway|Adapter|DataSource|Model|Entity|Dao)\.[cm]?[jt]sx?$/;
const UI_NAME_JS = /(^|[._-])(component|components|page|pages|view|views|layout|layouts|screen|screens|template|templates|widget|widgets|styled|styles|style|theme-?provider|_app|_document|_layout|\+page|\+layout|\+error)\.[cm]?[jt]s$/;
const UI_NAME_OTHER = /^(views?|forms?|templates?|widgets?|components?|pages?|screens?|admin_views?)\.(py|rb|php|go|rs|dart|kt|swift|java|cs|ex|exs)$|_(widget|screen|page|view|component|dialog|sheet|card|tile|button|list|item)\.dart$/;
const UI_CAMEL_OTHER = /(Widget|Screen|Page|View|Fragment|Activity|ViewController|Cell|Component|Dialog|Sheet|Composable|Form|Window|Layout)\.(dart|kt|java|swift|m|mm|cs|vb)$/;
const LOGIC_NAME = /(^|[._-])(service|services|usecase|use-?case|usecases|use-?cases|interactor|interactors|domain|manager|managers|validator|validators|validation|validate|rules?|policy|policies|engine|engines|calculator|calculations?|calc|processor|processors|pipeline|pipelines|strategy|strategies|factory|factories|builder|builders|command|commands|job|jobs|worker|workers|task|tasks|scheduler|cron|mapper|mappers|transformer|transformers|formatter|formatters|parser|parsers|normalizer|sanitizer|guard|guards|interceptor|interceptors|decorator|decorators|helper|helpers|util|utils|utilities|lib|core|logic|common|shared|constants?|auth|authentication|authorization|permissions?|crypto|hash|session|email|mail|mailer|notification|notifications|payment|payments|billing|pricing|checkout|cart|order|orders|inventory|search|analytics|tracking|logger|logging|log|metrics|events?|event-?bus|emitter|dispatcher|hooks?|composable|composables|errors?|exceptions?|result|option|math|date|dates|time|string|strings|array|object|number|format|parse|convert|compute)\.[cm]?[jt]sx?$|^use-[a-z-]+\.[cm]?[jt]sx?$|(^|[._-])(service|services|usecase|use_case|interactor|domain|manager|validator|validators|helper|helpers|util|utils|logic|core|engine|processor|worker|job|jobs|tasks?|commands?|auth|main|app|application|server|index|lib|mod|errors?|exceptions?|signals)\.(py|go|rs|rb|php|java|kt|cs|swift|dart|ex|exs|scala|c|cc|cpp|h|hpp|lua|r|jl|hs|ml|zig|nim)$/;
const LOGIC_CAMEL = /^use[A-Z]\w*\.[cm]?[jt]sx?$|[a-z0-9](Service|UseCase|Interactor|Manager|Validator|Helper|Helpers|Utils?|Engine|Processor|Worker|Job|Policy|Factory|Builder|Mapper|Parser|Formatter|Guard|Handler|Strategy|Calculator|Scheduler)\.[cm]?[jt]sx?$/;
const CONFIG_NAME = /(^|[._-])config(uration)?s?\.[cm]?[jt]sx?$|\.config\.(c?m?[jt]s|json|ya?ml|toml|py|rb)$|^config\.(py|rb|go|rs|ex|exs|php|java|kt|cs|swift|dart)$|^settings\.(py|json|ya?ml|toml|gradle|xml|ts|js)$|^application(-[a-z]+)?\.(properties|ya?ml)$|^appsettings(\.[a-z]+)?\.json$|\.conf$|^\.[a-z-]+rc(\.(json|ya?ml|js|cjs|toml))?$|^env\.[cm]?[jt]s$|^environment(\.[a-z]+)?\.ts$|^constants\.env\.[jt]s$/i;
const ENV_NAME = /^\.env(\..+)?$|\.env\.(example|sample|template|local|development|production|test|staging)$|^\.(envrc|flaskenv)$/i;
const DOCKER_NAME = /^(dockerfile|containerfile)(\..+)?$|\.dockerfile$|^docker-compose(\..+)?\.ya?ml$|^compose(\..+)?\.ya?ml$/i;
const ROOT_SCRIPT_NAME = /^manage\.py$|^(gulpfile|gruntfile|codegen|generate|gen|seed|seeds|seeder|bootstrap|install|postinstall|prebuild|release|publish|deploy|migrate|sync|cleanup|lint|format|check|bench|benchmark)[._-]?[a-z-]*\.(c?m?[jt]s|py|rb)$|^(build|setup)\.(c?m?[jt]s|rb|sh)$/i;
const SEED_DATA_NAME = /(^|[._-])(seed|seeds|seeder|seeders|fixtures?-?data|sample-?data|mock-?data|dummy-?data)\.(json|csv|ya?ml|sql|[cm]?[jt]s|py|rb)$/i;

export interface LayerInput {
  path: string;
  /** Only used to sniff JSX / styled-components presence — no parsing. */
  content?: string | null;
}

function extOfName(name: string): string {
  const lower = name.toLowerCase();
  if (lower.endsWith(".blade.php")) return "blade.php";
  if (/\.d\.[cm]?ts$/.test(lower)) return "ts";
  const i = lower.lastIndexOf(".");
  return i === -1 || i === 0 ? "" : lower.slice(i + 1);
}

/** Classify a file into exactly one best-fit layer. Rule order encodes priority. */
export function classifyLayer(input: LayerInput): LayerId {
  const path = input.path.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = path.split("/");
  const name = parts[parts.length - 1] || "";
  const lower = name.toLowerCase();
  const dirs = parts.slice(0, -1).map((d) => d.toLowerCase());
  const has = (set: Set<string>) => dirs.some((d) => set.has(d));
  const lastDir = dirs[dirs.length - 1] ?? "";
  const e = extOfName(name);
  const depth = dirs.length;
  const isJs = JS_EXT.has(e);
  const isJsx = JSX_EXT.has(e);
  const isCode = CODE_EXT.has(e);

  // Nearest ancestor that carries a semantic meaning (so app/services/x.rb → logic, not ui).
  let nearest: DirKind | null = null;
  let nearestDir = "";
  for (let i = dirs.length - 1; i >= 0; i--) {
    const k = dirKind(dirs[i]);
    if (k) {
      nearest = k;
      nearestDir = dirs[i];
      break;
    }
  }

  // 1. Tests — strongest signal.
  if (has(TEST_DIRS) || TEST_NAME.test(name)) return "tests";

  // 2. i18n & content.
  if (I18N_FILE.test(lower)) return "i18n-content";
  if (has(I18N_DIRS) && (!isCode || LOCALE_FILE.test(lower))) return "i18n-content";
  if (LOCALE_FILE.test(lower) && /^(locales?|i18n|translations?|lang|langs|intl|l10n|messages|strings)$/.test(lastDir)) return "i18n-content";
  if (/^res\/values(-[a-z-]+)?\/strings\.xml$/i.test(path) || /\.lproj\//i.test(path)) return "i18n-content";

  // 3. Design assets.
  if (IMAGE_FONT_EXT.has(e)) return "design-assets";
  if (THEME_NAME.test(lower) && !DOC_EXT.has(e)) return "design-assets";
  if (TOKENS_NAME.test(lower) && !DOC_EXT.has(e) && !NOT_DESIGN_CONTEXT.test(path)) return "design-assets";
  if (has(ASSET_DIRS) && !STYLE_EXT.has(e) && !MARKUP_EXT.has(e)) return "design-assets";
  if (/^(public|static|assets)\//i.test(path) && !isCode && !STYLE_EXT.has(e) && !MARKUP_EXT.has(e) && !MANIFEST_NAMES.has(lower) && !DOC_EXT.has(e) && !DATA_EXT.has(e)) {
    return "design-assets";
  }

  // 4. Docs.
  if (DOC_NAME.test(lower) && (DOC_EXT.has(e) || e === "")) return "docs";
  if (DOC_EXT.has(e) && !/^robots\.txt$/.test(lower) && !/^(requirements|constraints)[^/]*\.txt$/.test(lower) && !/^cmakelists\.txt$/.test(lower)) return "docs";
  if (has(DOC_DIRS) && !isCode && !STYLE_EXT.has(e)) return "docs";

  // 5. Unambiguous manifests & lockfiles.
  if (LOCKFILE_NAMES.has(lower) || MANIFEST_NAMES.has(lower)) return "config-infra";
  if (ENV_NAME.test(lower) || DOCKER_NAME.test(lower)) return "config-infra";

  // 6. Tooling & scripts.
  if (LINT_NAMES.test(name)) return "tooling-scripts";
  if (has(TOOLING_DIRS)) return "tooling-scripts";
  if (/\.(sh|bash|zsh|fish|ps1|psm1|bat|cmd|rake|awk)$/.test(lower)) return "tooling-scripts";
  if (ROOT_SCRIPT_NAME.test(lower) && depth <= 1) return "tooling-scripts";
  if (SEED_DATA_NAME.test(lower)) return "tooling-scripts";
  if (/\.(csv|tsv|ndjson|jsonl|parquet)$/.test(lower)) return "tooling-scripts";

  // 7. API endpoints that look like routes (Next.js app/api/**/route.ts, SvelteKit +server.ts) → data layer,
  //    then routing by strong name (wins over config/ dirs: config/routes.rb).
  if (/^route\.[cm]?[jt]s$/.test(lower) && dirs.includes("api")) return "data-api";
  if (/^\+server\.[jt]s$/.test(lower)) return "data-api";
  if (ROUTING_NAME_STRONG.test(lower)) return "routing";
  // Next.js root middleware (URL rewrites/redirects) and Remix/RR loaders at shallow depth.
  if (/^middleware\.[cm]?[jt]s$/.test(lower) && depth <= 1) return "routing";
  if (/^loader\.[jt]s$/.test(lower) && nearest === "routing") return "routing";

  // 8. Config & infra.
  if (/\.(tf|tfvars|hcl|nomad|bicep|cue)$/.test(lower)) return "config-infra";
  if (has(CONFIG_DIRS) && !(isJsx && nearest === "ui")) return "config-infra";
  if (CONFIG_NAME.test(lower) && !STATE_NAME.test(lower) && !STATE_CAMEL.test(name)) return "config-infra";
  if (/\.(toml|ini|cfg|properties|plist|entitlements|pbxproj|xcconfig|gradle|kts|sln|csproj|fsproj|vbproj|props|targets|nuspec|podspec|gemspec|cabal|opam|nimble)$/.test(lower)) return "config-infra";

  // 9. Types & schemas.
  if (nearest === "types" && !MARKUP_EXT.has(e) && !STYLE_EXT.has(e)) return "types-schemas";
  if (TYPES_NAME.test(lower) || TYPES_CAMEL.test(name)) return "types-schemas";

  // 10. Name-based signals, most specific first.
  if (!isJsx && ROUTING_NAME_WEAK.test(lower)) return "routing";
  if (STATE_NAME.test(lower) || STATE_CAMEL.test(name)) return "state";
  if (DATA_HOOK_NAME.test(name)) return "data-api";
  if (!isJsx && (DATA_NAME.test(lower) || DATA_CAMEL.test(name))) return "data-api";
  if (STYLE_EXT.has(e) || MARKUP_EXT.has(e) || STORY_NAME.test(lower)) return "ui";
  if (!isJsx && isJs && UI_NAME_JS.test(lower)) return "ui";
  if (!isJs && (UI_NAME_OTHER.test(lower) || UI_CAMEL_OTHER.test(name))) return "ui";
  if (!isJsx && isCode && (LOGIC_NAME.test(lower) || LOGIC_CAMEL.test(name))) return "business-logic";

  // 11. Nearest semantic directory.
  if (nearest === "routing") {
    if (!isJsx || /^(routes?|router)$/.test(nearestDir)) return "routing";
  }
  if (nearest === "state") {
    // Go/Rust/Python "store" packages are repositories, not UI state.
    if (BACKEND_EXT.has(e) && /^stores?$/.test(nearestDir)) return "data-api";
    return "state";
  }
  if (nearest === "data") return "data-api";
  if (nearest === "ui" && (isCode || e === "")) return "ui";
  if (nearest === "logic" && isCode && !isJsx) return "business-logic";

  // 12. Extension & content fallbacks.
  if (isJsx) return "ui";
  if (input.content && isCode && /<[A-Z][A-Za-z0-9.]*[\s/>]|className=|\bstyled\.[a-z]+`|\bcss`/.test(input.content.slice(0, 6000))) return "ui";
  if (isCode) return "business-logic";
  if (DATA_EXT.has(e)) return "config-infra";
  if (e === "" && depth === 0) return "config-infra";
  return "business-logic";
}

// ---------- Session persistence for per-file overrides ----------

const OVERRIDE_KEY = "code-crusher:layer-overrides:";

export function loadLayerOverrides(rootName: string): Record<string, LayerId> {
  try {
    const raw = globalThis.sessionStorage?.getItem(OVERRIDE_KEY + rootName);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, string>;
    const out: Record<string, LayerId> = {};
    for (const [k, v] of Object.entries(parsed)) if (isLayerId(v)) out[k] = v;
    return out;
  } catch {
    return {};
  }
}

export function saveLayerOverrides(rootName: string, overrides: Record<string, LayerId>): void {
  try {
    const store = globalThis.sessionStorage;
    if (!store) return;
    if (Object.keys(overrides).length === 0) store.removeItem(OVERRIDE_KEY + rootName);
    else store.setItem(OVERRIDE_KEY + rootName, JSON.stringify(overrides));
  } catch {
    /* storage unavailable (private mode / quota) — overrides live in memory only */
  }
}
