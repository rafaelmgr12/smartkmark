# SmartKMark

Editor Markdown desktop com preview em tempo real, construído com **Electron**, **React**, **TypeScript** e **Tailwind CSS**.

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Electron](https://img.shields.io/badge/electron-33-47848F?logo=electron&logoColor=white)
![React](https://img.shields.io/badge/react-18-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/typescript-5-3178C6?logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/tailwindcss-3-06B6D4?logo=tailwindcss&logoColor=white)

---

## Funcionalidades

- **Editor lado a lado** — painel de edição Markdown à esquerda e preview renderizado à direita
- **Preview em tempo real** — o conteúdo é atualizado conforme você digita
- **GitHub Flavored Markdown (GFM)** — suporte a tabelas, tachado (~~texto~~), listas de tarefas e mais
- **Tema claro / escuro** — alterne entre temas com um clique
- **Abrir e salvar arquivos** — leia e escreva arquivos `.md` / `.markdown` diretamente do sistema de arquivos
- **Atalhos de teclado** — `Ctrl/Cmd + O` para abrir, `Ctrl/Cmd + S` para salvar
- **Multiplataforma** — builds para Linux (AppImage, deb), Windows (NSIS) e macOS (DMG)

---

## Tech Stack

| Camada       | Tecnologia                                                        |
| ------------ | ----------------------------------------------------------------- |
| Runtime      | [Electron 33](https://www.electronjs.org/)                        |
| UI           | [React 18](https://react.dev/) + [TypeScript 5](https://www.typescriptlang.org/) |
| Estilização  | [Tailwind CSS 3](https://tailwindcss.com/) + [@tailwindcss/typography](https://tailwindcss.com/docs/typography-plugin) |
| Markdown     | [react-markdown](https://github.com/remarkjs/react-markdown) + [remark-gfm](https://github.com/remarkjs/remark-gfm) |
| Bundler      | [Vite 6](https://vite.dev/)                                      |
| Build/Dist   | [electron-builder](https://www.electron.build/)                   |

---

## Estrutura do projeto

```
smartkmark/
├── electron/
│   ├── main.ts            # Processo principal do Electron
│   ├── preload.ts         # Bridge segura (contextBridge) entre renderer e main
│   └── tsconfig.json      # Config TypeScript para o processo Electron
├── src/
│   ├── App.tsx            # Componente principal (editor + preview)
│   ├── App.css            # Estilos customizados (GitHub-flavored markdown)
│   ├── index.css          # Diretivas Tailwind + overrides
│   ├── main.tsx           # Ponto de entrada do React
│   └── vite-env.d.ts      # Tipos do Vite
├── index.html             # HTML template
├── package.json
├── postcss.config.js      # Configuração PostCSS (Tailwind + Autoprefixer)
├── tailwind.config.js     # Configuração Tailwind CSS
├── tsconfig.json          # Config TypeScript para o renderer
└── vite.config.ts         # Configuração do Vite
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

| Comando              | Descrição                                                   |
| -------------------- | ----------------------------------------------------------- |
| `npm run dev`        | Inicia o Vite dev server + Electron em modo desenvolvimento |
| `npm run dev:renderer` | Inicia apenas o Vite dev server (React)                   |
| `npm run build`      | Compila o renderer (Vite) e o processo Electron (TypeScript) |
| `npm run dist`       | Build completo + empacotamento com electron-builder         |

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

| Plataforma | Formato          |
| ---------- | ---------------- |
| Linux      | AppImage, .deb   |
| Windows    | NSIS installer   |
| macOS      | .dmg             |

---

## Arquitetura

```
┌─────────────────────────────────────────────────────┐
│                    Electron Main                     │
│  (electron/main.ts)                                  │
│  - Cria a BrowserWindow                              │
│  - Gerencia IPC handlers (abrir/salvar arquivos)     │
└────────────────────┬────────────────────────────────┘
                     │ IPC (contextBridge)
┌────────────────────▼────────────────────────────────┐
│                   Preload Script                     │
│  (electron/preload.ts)                               │
│  - Expõe window.desktopApi                           │
│  - openMarkdownFile() / saveMarkdownFile()           │
└────────────────────┬────────────────────────────────┘
                     │
┌────────────────────▼────────────────────────────────┐
│                  React Renderer                      │
│  (src/App.tsx)                                       │
│  - Editor de texto (textarea)                        │
│  - Preview com ReactMarkdown + remark-gfm            │
│  - Tailwind CSS para estilização                     │
│  - Tema claro/escuro                                 │
└─────────────────────────────────────────────────────┘
```

A comunicação entre o renderer (React) e o processo principal (Electron) é feita de forma segura via `contextBridge`, expondo apenas duas funções:

- **`window.desktopApi.openMarkdownFile()`** — abre o diálogo nativo de seleção de arquivo e retorna o conteúdo
- **`window.desktopApi.saveMarkdownFile(payload)`** — salva o conteúdo no caminho especificado ou abre o diálogo "Salvar como"

---

## Atalhos de teclado

| Atalho             | Ação                  |
| ------------------ | --------------------- |
| `Ctrl/Cmd + O`     | Abrir arquivo .md     |
| `Ctrl/Cmd + S`     | Salvar arquivo .md    |

---

## Markdown suportado (GFM)

O preview suporta a especificação [GitHub Flavored Markdown](https://github.github.com/gfm/), incluindo:

- Headings (`# h1` até `###### h6`)
- **Negrito**, *itálico*, ~~tachado~~
- Listas ordenadas e não-ordenadas
- Blocos de código com syntax highlighting
- Tabelas
- Blockquotes
- Links e imagens
- Linhas horizontais (`---`)

---

## Licença

Este projeto é distribuído sob a licença [MIT](LICENSE).
