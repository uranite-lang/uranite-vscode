
<!--
@author hxAri (hxari)
@create 2025-02-24 15:15
@update 2026-06-18 00:04
@github https://github.com/uranite-lang/uranite

Uranite - Uranite Copyright (c) 2025 - hxAri <hxari@proton.me>
Uranite Licence under GNU General Public Licence v3

Documentation for the Uranite Visual Studio Code extension.

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
any later version.

You should have received a copy of the GNU General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.
-->

# Uranite Language Support for VSCode

This extension provides syntax highlighting and basic language configuration for the Uranite programming language (`*.urn`).

## Features

- **Syntax Highlighting**: Full keyword coverage including control flow, declarations, modifiers, type checking, and async/await.
- **Type Highlighting**: All built-in OOP types (`I64`, `String`, `Boolean`, `Callable`, `Meta`, etc.), primitive types, nullable types (`?Type`), and generic type detection.
- **Literals**: `True`, `False`, `None`, numeric (hex, binary, octal, float, integer).
- **Operators**: Arithmetic, comparison, bitwise, assignment, range (`..`), spread (`...`), arrow (`->`), fat arrow (`=>`), scope resolution (`::`).
- **Language Configuration**: Indentation-based blocks (colon triggers indent), auto-closing brackets/quotes/block comments, and folding.
- **Comments**: Line (`#`) and block (`#{ }#`).
- **Keywords**: `function`, `property`, `lambda`, `class`, `struct`, `enum`, `interface`, `unit`, `backed`, `instanceof`, `subclassof`, `async`, `await`, `defer`, `try`, `except`, `raise`, `raises`, `finally`, `extends`, `implements`, `virtual`, `override`, `abstract`, `final`, `Readonly`, `static`, `new`, `delete`, `export`, `import`, `from`, `package`, `extern`, and more.

## Installation

To use this extension locally:

1.  Copy or link the `extensions/uranite-vsc` folder to your VSCode extensions directory:
    - **Linux/macOS**: `~/.vscode/extensions/`
    - **Windows**: `%USERPROFILE%\.vscode\extensions\`
2.  Restart VSCode.

Example command for Linux:
```bash
ln -s $(pwd)/extensions/uranite-vsc ~/.vscode/extensions/uranite-vsc
```

## Language Reference

Uranite is an indentation-based compiled language. For full documentation, see `CLAUDE.md` in the project root.
