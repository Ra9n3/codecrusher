🎯 How Eviction Works
When your repo exceeds the budget, the planner evicts in three tiers:
Junk first: Lockfiles, binaries, generated code.
Oversized next: Files far above the median size get the boot.
Least-central last: Files with the fewest connections to the rest of the codebase, biggest first.
Protected files are never evicted silently. You always see exactly what was cut, and why.
🚀 How to Use It
Open the Live Web App.
Drag & drop your project folder, or upload a .zip export straight from GitHub.
Pick a Crush Profile or toggle layers, set your Token Budget, and choose full source or signatures-only.
Hit Crush — then Copy or Download the .txt straight into your AI prompt.
🧑‍💻 Technical Architecture
The pipeline handles code transformation through a purely client-side lifecycle:
Client-Side Unzipper / File Reader: Parses the local directory or zip file.
Layer Classifier Engine (layers.ts): Maps individual code trees into queryable architectural slices.
Centrality Score Evaluator: Analyzes import dependencies to determine architectural importance.
Eviction Planner (budget.ts): Calculates token weights and executes the file eviction logic, replacing heavy files with placeholders.
Consolidated Output: Generates the final, budget-compliant .txt file.
⚠️ Honest Limitations
Token counts are fast estimates (~4 characters ≈ 1 token), not an exact tokenizer. Good enough for budgeting, not for invoicing.
Repos that are already tiny or mostly one huge generated file have less to evict. The tool will explicitly tell you when the budget is impossible.
🤝 Contributing & Feedback
This tool is 100% free, open-source, and created to give back to the developer community. If you want a new eviction strategy, better framework classification, or found a bug:
Fork the repository
Create your feature branch (git checkout -b feature/AmazingFeature)
Commit your changes (git commit -m 'Add some AmazingFeature')
Push to the branch (git push origin feature/AmazingFeature)
Open a Pull Request
📄 License
Distributed under the AGPL-3.0 License. See LICENSE for more information.
