<img width="1892" height="808" alt="codecrusher1" src="https://github.com/user-attachments/assets/c8a54f11-a83d-4770-9a0d-d7c0be541561" />
<img width="1885" height="822" alt="codecrusher2" src="https://github.com/user-attachments/assets/358772e3-3fd7-4d15-baf4-4936621fc872" />

# ⚡ Code Crusher

> **Crush an entire repository into a single, token-budgeted, AI-ready text file.** 
> 100% local. Zero servers. Zero token waste.

[![Live App](https://img.shields.io/badge/Live%20App-ra9n3.github.io-blue)](https://ra9n3.github.io/codecrusher/)
[![License: GPL v3](https://img.shields.io/badge/license-GPL%20v3-blue)](LICENSE)

---

## 🤔 Why Code Crusher?

Feeding an entire repository into Claude, ChatGPT, or local LLMs usually results in two massive headaches:
1. **Context Bloat:** You blow past context windows or pay an arm and a leg for the AI to parse unneeded dependencies, massive `package-lock.json` files, and binaries.
2. **Blind Truncation:** Existing tools either dump everything or vaporize files completely, leaving the AI entirely blind to your repository's layout.

**Code Crusher** solves this by letting you surgically slice your codebase, track your token budget, and auto-evict heavy, low-priority files while maintaining project structure.

---

## ✨ Features

* 🔒 **100% Client-Side Privacy:** Your code never touches a backend. Unzipping, parsing, and token estimation run entirely in your browser memory.
* 📉 **Smart Token Budgeting:** Set a strict target token limit. The app applies a centrality scoring algorithm to automatically evict the heaviest, least essential files until your codebase fits perfectly.
* 🧭 **No "Ghost Files" (Placeholders):** When a file or binary is dropped to save budget, Code Crusher leaves a precise one-line comment placeholder. The LLM still understands your exact file tree and paths without choking on the raw content.
* 🎛️ **Architectural Slicing:** Isolate what matters. Instantly filter your codebase across **12 architectural layers**—grab just the core business logic or APIs while stripping away test suites and heavy configurations.

---

## 🛠️ Built With

Code Crusher is an ultra-fast, modern web app built on a lean frontend stack:
* **React 19** – Component-driven architecture
* **Vite 7** – Lightning-fast build pipeline
* **Tailwind CSS v4** – Modern, high-performance styling
* **Vitest** – Robust local unit testing pipeline

---

## 🚀 How to Use It

1. Open the [Live Web App]( https://ra9n3.github.io/codecrusher/).
2. Drag and drop your project folder, or upload a `.zip` export directly from GitHub.
3. Select your target **Token Budget** and toggle architectural **Layers**.
4. Click **Crush** and copy the optimized text file directly into your AI prompt!

---

## 🧑‍💻 Technical Architecture Overview

The pipeline handles code transformation through a purely client-side lifecyle:

[ Repo Folder / Zip ] ──> [ Client-Side Unzipper ]
│
▼
[ Layer Classifier Engine ]
│
▼
[ Centrality Score Evaluator ]
│
▼
[ budget.ts Eviction Planner ] ──> (Replaces heavy files with placeholders)
│
▼
[ Consolidated .txt ]

* **`src/lib/processor.ts`:** Manages client-side file stream reading and builds the initial flat context map.
* **`src/lib/budget.ts`:** Calculates token weights and executes the file eviction logic when the project exceeds user limits.
* **`src/lib/filters.ts` / `layers.ts`:** Maps individual code trees into queryable architectural slices.

---

## 🤝 Contributing & Feedback

This tool is **100% free, open-source, and created to give back to the developer community**. If you want to see a new eviction strategy, better framework classification, or find a bug:

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📄 License

Distributed under the gpl v3 License. See `LICENSE` for more information.
