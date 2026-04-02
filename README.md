# SmartKMark

Aplicativo desktop de notas em Markdown com interface de três painéis, persistência local no sistema de arquivos e preview em tempo real. Construído com **Electron**, **React**, **TypeScript** e **Tailwind CSS**.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Electron](https://img.shields.io/badge/electron-33-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/react-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/tailwindcss-3-06B6D4?logo=tailwindcss&logoColor=white)

---

## Funcionalidades

- **Interface de 3 painéis** — sidebar de notebooks, lista de notas e editor de markdown
- **Persistência local** — notas salvas em `~/Documents/SmartKMark/[notebook]/[nota].md` com YAML frontmatter
- **CRUD completo de notebooks** — criar e deletar notebooks diretamente na sidebar
- **CRUD completo de notas** — criar, editar, deletar e fixar notas
- **Editor Markdown** — textarea com inserção de formatação via toolbar e atalhos de teclado
- **Preview em tempo real** — alterne entre modo edição e preview renderizado (Ctrl+E)
- **Auto-save** — notas são salvas automaticamente após 800ms de inatividade
- **GitHub Flavored Markdown (GFM)** — suporte a tabelas, tachado, listas de tarefas e mais
- **Busca** — filtre notas por título na barra de busca
- **Pin de notas** — fixe notas importantes no topo
- **Toolbar de formatação** — negrito, itálico, tachado, links, imagens, code blocks, listas, blockquotes, HR
- **Multiplataforma** — builds para Linux (AppImage, deb), Windows (NSIS) e macOS (DMG)

---

## Tech Stack

| Camada | Tecnologia |
|---|---|
| Runtime | [Electron 33](https://www.electronjs.org/) |
| UI | [React 18](https://react.dev/) + [TypeScript 5](https://www.typescriptlang.org/) |
| Estilização | [Tailwind CSS 3](https://tailwindcss.com/) + [@tailwindcss/typography](https://tailwindcss.com/docs/typography-plugin) |
| Markdown | [react-markdown](https://github.com/remarkjs/react-markdown) + [remark-gfm](https://github.com/remarkjs/remark-gfm) |
| Frontmatter | [gray-matter](https://github.com/jonschlinkert/gray-matter) |
| Ícones | [Lucide React](https://lucide.dev/) |
| Bundler | [Vite 6](https://vite.dev/) |
| Build/Dist | [electron-builder](https://www.electron.build/) |

---

## Estrutura do projeto

```text
smartkmark/
├── electron/
│   ├── main.ts              # Processo principal — IPC handlers, file system CRUD
│   ├── preload.ts           # contextBridge — expõe window.desktopApi
│   └── tsconfig.json        # Config TypeScript para o processo Electron
├── src/
│   ├── components/
│   │   ├── ui/              # Componentes reutilizáveis (Badge, IconButton, SearchInput, CountBadge)
│   │   ├── sidebar/         # Sidebar, SidebarSection, SidebarItem, UserProfile
│   │   ├── notes/           # NoteList, NoteCard
│   │   └── editor/          # NoteEditor, EditorToolbar, TagBar, NoteContent
│   ├── hooks/
│   │   └── useAppState.ts   # Hook centralizado — CRUD notebooks/notes, filtros, seleção
│   ├── lib/
│   │   └── markdown-shortcuts.ts  # Helpers de formatação (wrap, prefix, insert)
│   ├── types/
│   │   └── index.ts         # Tipos (Note, Notebook, DesktopApi, etc.)
│   ├── App.tsx              # Componente raiz — layout 3 painéis + atalhos globais
│   ├── index.css            # Diretivas Tailwind + scrollbar customizado
│   ├── main.tsx             # Ponto de entrada do React
│   └── vite-env.d.ts        # Tipos do Vite
├── index.html
├── package.json
├── postcss.config.js
├── tailwind.config.js
├── tsconfig.json
└── vite.config.ts
```

---

## Persistência de dados

As notas são salvas no sistema de arquivos em:

```text
~/Documents/SmartKMark/
├── Inbox/                   # Notebook padrão (criado automaticamente)
│   └── minha-nota.md
├── Projetos/
│   └── todo-app.md
└── Ideias/
    └── nova-feature.md
```

Cada arquivo `.md` contém YAML frontmatter com metadados:

```yaml
---
id: "a1b2c3d4-..."
title: "Minha Nota"
tags:
  - label: "React"
    color: "green"
pinned: true
status: "active"
createdAt: "2025-01-01T00:00:00.000Z"
updatedAt: "2025-01-01T12:00:00.000Z"
---

Conteúdo markdown aqui...
```

---

## Pré-requisitos

- [Node.js](https://nodejs.org/) >= 18
- npm >= 9

---

## Instalação

```bash
git clone https://github.com/rafaelmgr12/smartkmark.git
cd smartkmark
npm install
```

---

## Scripts disponíveis

| Comando | Descrição |
|---|---|
| `npm run dev` | Inicia Vite + Electron em modo desenvolvimento |
| `npm run dev:renderer` | Inicia apenas o Vite dev server (React) |
| `npm run build` | Compila renderer (Vite) + processo Electron (TypeScript) |
| `npm run dist` | Build completo + empacotamento com electron-builder |

### Desenvolvimento

```bash
npm run dev
```

Isso inicia:

1. O **Vite dev server** na porta `5173` com hot reload
2. O **compilador TypeScript** em watch mode para os arquivos Electron
3. O **Electron** apontando para `http://localhost:5173`

### Build de produção

```bash
npm run build
```

### Gerar instalador

```bash
npm run dist
```

Os artefatos são gerados na pasta `release/`:

| Plataforma | Formato |
|---|---|
| Linux | AppImage, .deb |
| Windows | NSIS installer |
| macOS | .dmg |

---

## Arquitetura

```text
┌──────────────────────────────────────────────────────┐
│                   Electron Main                       │
│  (electron/main.ts)                                   │
│  - Cria a BrowserWindow                               │
│  - File system CRUD (notebooks = dirs, notes = .md)   │
│  - IPC handlers: notebooks:*, notes:*                 │
│  - Parsing de frontmatter com gray-matter             │
└───────────────────┬──────────────────────────────────┘
                    │ IPC (contextBridge)
┌───────────────────▼──────────────────────────────────┐
│                  Preload Script                        │
│  (electron/preload.ts)                                │
│  - Expõe window.desktopApi com 10 métodos             │
│  - listNotebooks, createNotebook, deleteNotebook      │
│  - listNotes, getNote, createNote, updateNote, ...    │
└───────────────────┬──────────────────────────────────┘
                    │
┌───────────────────▼──────────────────────────────────┐
│                 React Renderer                        │
│                                                       │
│  ┌─────────┐ ┌──────────┐ ┌────────────────────────┐ │
│  │ Sidebar │ │ NoteList │ │      NoteEditor        │ │
│  │         │ │          │ │  Title + Tags + Toolbar │ │
│  │ Notebooks│ │ Cards   │ │  Textarea / Preview    │ │
│  │ Create  │ │ Search  │ │  Auto-save (800ms)     │ │
│  │ Delete  │ │ Pin/Del │ │  Keyboard shortcuts    │ │
│  └─────────┘ └──────────┘ └────────────────────────┘ │
│                                                       │
│  useAppState — hook centralizado (IPC ↔ state)        │
└──────────────────────────────────────────────────────┘
```

---

## Componentes

| Componente | Responsabilidade |
|---|---|
| `Sidebar` | Navegação entre notebooks, criar/deletar notebooks |
| `SidebarSection` | Seção colapsável reutilizável |
| `SidebarItem` | Item de navegação com ícone, label e contador |
| `NoteList` | Lista de notas com busca, criar/deletar/pin |
| `NoteCard` | Card de nota com título, tempo relativo e tags |
| `NoteEditor` | Editor completo com título editável, auto-save e atalhos |
| `EditorToolbar` | Botões de formatação markdown + toggle edit/preview |
| `NoteContent` | Preview markdown renderizado com `@tailwindcss/typography` |
| `TagBar` | Exibe notebook e tags da nota ativa |
| `Badge` | Badge reutilizável com 6 variantes de cor |
| `IconButton` | Botão de ícone reutilizável com estado ativo |
| `SearchInput` | Input de busca reutilizável com ícone |
| `CountBadge` | Contador numérico reutilizável |

---

## Atalhos de teclado

| Atalho | Ação |
|---|---|
| `Ctrl/Cmd + N` | Criar nova nota |
| `Ctrl/Cmd + S` | Salvar nota imediatamente |
| `Ctrl/Cmd + E` | Alternar entre edição e preview |
| `Ctrl/Cmd + B` | **Negrito** |
| `Ctrl/Cmd + I` | *Itálico* |
| `Ctrl/Cmd + K` | Inserir link |

---

## Markdown suportado (GFM)

O preview suporta a especificação [GitHub Flavored Markdown](https://github.github.com/gfm/), incluindo:

- Headings (`# h1` até `###### h6`)
- **Negrito**, *itálico*, ~~tachado~~
- Listas ordenadas, não-ordenadas e de tarefas
- Blocos de código com syntax highlighting
- Tabelas
- Blockquotes
- Links e imagens
- Linhas horizontais (`---`)

---

## Licença

Este projeto é distribuído sob a licença [MIT](LICENSE).
