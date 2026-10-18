<p align="center">
  <img src="assets/finestfile-logo.svg" width="128" height="128" alt="FinestFile Logo" />
</p>

# FinestFile

**FinestFile** is a practical, lightweight, professional, open-source file manager and archive utility for Windows 10 and Windows 11.

---

## 🌟 Highlights & Philosophy

- **Native Windows Feel**: Restrained, modern Windows 11 visual design with subtle surfaces, system font stack, high-contrast clarity, and zero neon/cyberpunk clutter.
- **Fast & Lightweight**: Built with a memory-efficient Rust core and modern React/TypeScript frontend on Tauri 2.
- **Integrated ZIP Management**: Create and safely extract ZIP archives with strict Zip-Slip protection, bomb limits, and conflict handling.
- **Background Operations**: Real-time progress reporting and cancellation for file copying, moving, trashing, and archiving.
- **Configurable Metadata Indexing**: Optional SQLite-backed local indexing that can be paused, resumed, or completely disabled. Full file contents are never read or stored.
- **Recycle Bin Integration**: Default deletion moves items safely to the Windows Recycle Bin using native shell APIs, with optional permanent deletion.

---

## 🛠️ Technology Stack

- **Core Engine**: Rust (`windows-sys`, `rusqlite`, `zip`, `trash`, `notify`, `serde`)
- **Desktop Runtime**: Tauri 2
- **Frontend**: React 18, TypeScript, Vite, CSS Modules, Lucide Icons

---

## 🚀 Building from Source

### Prerequisites

1. **Rust**: 1.80+ (`rustup default stable`)
2. **Node.js**: v20+ & npm
3. **C++ Build Tools**: Microsoft Visual Studio C++ build tools (MSVC toolchain)

### Setup

```bash
# Clone the repository
git clone https://github.com/finestfile/finestfile.git
cd finestfile

# Install frontend dependencies
npm install

# Run the test suite for the core engine
cargo test -p finestfile-core

# Launch FinestFile in development mode
npm run tauri dev
```

---

## 📖 Research & Reference

FinestFile was designed following systematic analysis of Windows File Explorer's observable interaction patterns, keyboard accelerators, and system integration. See [Windows File Explorer Analysis](docs/research/windows-file-explorer-analysis.md) for details.

---

## 📄 License

FinestFile is licensed under the permissive [MIT License](LICENSE).
