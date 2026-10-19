# 🔨 Code Crusher

Turn any codebase into one AI-ready text file — on budget, on structure, 100% in your browser.

[🚀 Open the Live App] (https://ra9n3.github.io/codecrusher/) · [🐛 Report a Bug](https://github.com/Ra9n3/codecrusher/issues) · [📦 Releases](https://github.com/Ra9n3/codecrusher/releases)

## Why Code Crusher?

Feeding an entire repository into an LLM usually ends in two massive headaches:

1. **Context Bloat:** You blow past context windows paying the AI to parse unneeded dependencies, massive `package-lock.json` files, and binaries.
2. **Blind Truncation:** Existing tools either dump everything or vaporize files completely, leaving the AI entirely blind to your repository's layout.

Code Crusher solves this by letting you surgically slice your codebase, track a strict token budget, and auto-evict heavy, low-priority files — while the AI still sees your exact project structure.

## ✨ Features

- 🔒 **100% Client-Side Privacy:** Unzipping, parsing, and token estimation run entirely in your browser memory. Your code never touches a backend.
- 📉 **Strict Token Budgeting:** Presets from 30k to 500k, a live BudgetBar, and a planner that evicts until you fit (with a built-in safety margin).
- 🧭 **No "Ghost Files":** Evicted files leave a precise one-line placeholder. The LLM still understands your exact file tree and paths.
- 🎛️ **Architectural Slicing:** Every file belongs to exactly one of 12 layers. Grab just UI, business logic, or APIs while stripping test suites and heavy configs.
- 🧪 **Crush Profiles:** One-click presets for every mission: *How it works, UI & design, API & data, Docs only, Tests, Setup*.
- 📊 **Model-Fit Meter:** See your crush as a live percentage of GPT, Claude, and Gemini context windows before you paste anything.
- 🛡️ **Protected Files:** Your `README`, `index.*`, `main.*`, and `app.*` are never silently evicted.
- ✂️ **Signatures-Only Mode:** Strip function bodies, keeping only the API surface the AI actually needs.
- 🧠 **Smart Eviction Guard:** Never evicts a file whose placeholder would cost more tokens than the file itself saves. Every eviction is net-positive.
- 📏 **Honest Accounting:** Placeholder and tree overhead are counted for real. No silent over-budget drift.

### What a placeholder looks like:

```typescript
// [EVICTED] src/utils/deepDependencyMap.ts — 4,120 tokens — evicted to fit budget (least-central, largest)
```

## 🎯 How Eviction Works

When your repo exceeds the budget, the planner evicts in three tiers:

1. **Junk first:** Lockfiles, binaries, generated code.
2. **Oversized next:** Files far above the median size get the boot.
3. **Least-central last:** Files with the fewest connections to the rest of the codebase, biggest first.

Protected files are never evicted silently. You always see exactly what was cut, and why.

## 🚀 How to Use It

1. Open the Live Web App.
2. Drag & drop your project folder, or upload a `.zip` export straight from GitHub.
3. Pick a Crush Profile or toggle layers, set your Token Budget, and choose full source or signatures-only.
4. Hit **Crush** — then Copy or Download the `.txt` straight into your AI prompt.

## 🧑‍💻 Technical Architecture

The pipeline handles code transformation through a purely client-side lifecycle:

1. **Client-Side Unzipper / File Reader:** Parses the local directory or zip file.
2. **Layer Classifier Engine (`layers.ts`):** Maps individual code trees into queryable architectural slices.
3. **Centrality Score Evaluator:** Analyzes import dependencies to determine architectural importance.
4. **Eviction Planner (`budget.ts`):** Calculates token weights and executes the file eviction logic, replacing heavy files with placeholders.
5. **Consolidated Output:** Generates the final, budget-compliant `.txt` file.

## ⚠️ Honest Limitations

- Token counts are fast estimates (~4 characters ≈ 1 token), not an exact tokenizer. Good enough for budgeting, not for invoicing.
- Repos that are already tiny or mostly one huge generated file have less to evict. The tool will explicitly tell you when the budget is impossible.

## 🤝 Contributing & Feedback

This tool is 100% free, open-source, and created to give back to the developer community. If you want a new eviction strategy, better framework classification, or found a bug:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

Distributed under the **AGPL-3.0 License**. See `LICENSE` for more information.
