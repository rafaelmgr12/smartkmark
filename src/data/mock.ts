import type { Note, Notebook } from '../types';

export const NOTEBOOKS: Notebook[] = [
  { id: 'awesome-saas', name: 'Awesome SaaS' },
  { id: 'desktop-app', name: 'Desktop app' },
  { id: 'ideas', name: 'Ideas' },
  { id: 'mobile-app', name: 'Mobile app' },
  { id: 'operations', name: 'Operations' },
  { id: 'website', name: 'Website' },
];

export const NOTES: Note[] = [
  {
    id: '1',
    title: 'Record a webpage with background transparency using Puppeteer',
    body: '[Support for transparent video background. (Offer...)',
    notebookId: 'desktop-app',
    tags: [
      { id: 't1', label: 'React Native', color: 'green' },
      { id: 't2', label: 'Coding', color: 'orange' },
    ],
    createdAt: '2026-04-02T20:00:00.000Z',
    updatedAt: '2026-04-02T23:29:00.000Z',
    pinned: true,
    status: 'active',
  },
  {
    id: '2',
    title: 'Migrate ESLint YAML config to flat mjs config',
    body: 'Working on updating this repo. (GitHub + Inkdropa...',
    notebookId: 'operations',
    tags: [{ id: 't3', label: 'DevOps', color: 'blue' }],
    createdAt: '2026-04-02T19:30:00.000Z',
    updatedAt: '2026-04-02T23:29:00.000Z',
    pinned: false,
    status: 'active',
  },
  {
    id: '3',
    title: 'Fluid animations with threejs',
    body: '[Rain & Water Effect Experiments | Codrops] | http...',
    notebookId: 'ideas',
    tags: [{ id: 't4', label: 'Feature idea', color: 'purple' }],
    createdAt: '2026-04-02T19:00:00.000Z',
    updatedAt: '2026-04-02T23:29:00.000Z',
    pinned: false,
    status: 'active',
  },
  {
    id: '4',
    title: 'Create a new PouchDB adapter for op-sqlite',
    body: 'old repo: https://github.com/craftzdog/pouchdb-a...',
    notebookId: 'mobile-app',
    tags: [
      { id: 't1', label: 'React Native', color: 'green' },
      { id: 't2', label: 'Coding', color: 'orange' },
    ],
    createdAt: '2026-04-02T18:10:00.000Z',
    updatedAt: '2026-04-02T23:38:00.000Z',
    pinned: true,
    status: 'active',
  },
  {
    id: '5',
    title: 'Bump up deps of the web app',
    body: 'Bump up stripe From 14 to 17.4.0 https://www.npm...',
    notebookId: 'website',
    tags: [{ id: 't3', label: 'DevOps', color: 'blue' }],
    createdAt: '2026-04-02T18:00:00.000Z',
    updatedAt: '2026-04-02T23:27:00.000Z',
    pinned: false,
    status: 'completed',
  },
  {
    id: '6',
    title: 'Mermaid diagrams',
    body: 'graph LR A --- B B-->C[fa:fa-ban forbidden] B-->...',
    notebookId: 'ideas',
    tags: [{ id: 't4', label: 'Feature idea', color: 'purple' }],
    createdAt: '2026-03-21T12:00:00.000Z',
    updatedAt: '2026-03-22T12:00:00.000Z',
    pinned: false,
    status: 'onHold',
  },
  {
    id: '7',
    title: 'Fix a bug',
    body: 'There is a bug when switching between notebooks...',
    notebookId: 'desktop-app',
    tags: [{ id: 't5', label: 'Bug', color: 'red' }],
    createdAt: '2026-04-02T21:00:00.000Z',
    updatedAt: '2026-04-02T22:00:00.000Z',
    pinned: false,
    status: 'active',
  },
];

export const SELECTED_NOTE_CONTENT = `## 📦 Migration

Specify the absolute path

- [op-sqlite Configuration](https://ospfranco.notion.site/Configuration
  -6b89264afcc4ac66b3779a34475599b35a0d477bbe5d1f23a31f56d50d5553c...)

\`\`\`typescript
import {
  IOS_LIBRARY_PATH, // Default iOS
  IOS_DOCUMENT_PATH,
  ANDROID_DATABASE_PATH, // Default Android
  ANDROID_FILES_PATH,
  ANDROID_EXTERNAL_FILES_PATH, // Android SD Card
  open,
} from '@op-engineering/op-sqlite';

const db = open({
  name: 'myDb',
  location: Platform.OS === 'ios' ? IOS_LIBRARY_PATH :
    ANDROID_DATABASE_PATH,
});
\`\`\`

quick-sqlite's [default location](https://github.com/nicegist/secret)
like-quick-sqlite/7ab0create-cv-file#loading-existing-dbal:

- The library creates/opens databases by appending the passed name
  plus the \`documents directory\` on iOS/macOS and the
`;
