import { JSDOM } from 'jsdom';
import { describe, expect, test } from 'vitest';

import {
  APPLY_MARKER,
  CHROME_ID,
  EXPERIENCE_MARKER,
  STYLE_ID,
  buildApplyExpression,
  buildRemoveExpression,
  buildVerificationExpression,
} from '../../src/engine/injection.mjs';

function runtimeTheme(overrides = {}) {
  return {
    manifest: {
      slug: 'test-theme',
      name: 'Test Theme',
      mode: 'dark',
      palette: {
        background: '#07111F',
        scrim: '#07111FD9',
        surface: '#142033CC',
        surfaceElevated: '#142033E8',
        surfaceOverlay: '#0B1220F2',
        input: '#18263BE6',
        text: '#F4F7FB',
        textSecondary: '#F4F7FBBF',
        textMuted: '#F4F7FB8F',
        textDisabled: '#F4F7FB66',
        icon: '#F4F7FB',
        iconSecondary: '#F4F7FBBF',
        iconMuted: '#F4F7FB8F',
        border: '#73E2FF38',
        borderSubtle: '#73E2FF1F',
        borderStrong: '#73E2FF70',
        accent: '#73E2FF',
        accentHover: '#A2EDFF',
        selection: '#73E2FF4D',
        focus: '#A2EDFF',
        link: '#8DE8FF',
        hover: '#73E2FF1F',
        active: '#73E2FF38',
        code: '#07101AF2',
        terminal: '#04080EF2',
        diffAdded: '#2DAA6A42',
        diffRemoved: '#FF5F5242',
        success: '#58D68D',
        warning: '#F6C85F',
        danger: '#FF6B64',
        scrollbar: '#73E2FF45',
        scrollbarHover: '#73E2FF78',
        composer: '#101B2AEF',
      },
      experience: {
        brand: 'LIMITLESS',
        eyebrow: 'SIX EYES',
        headline: 'LIMITLESS WORKSPACE',
        tagline: 'Plan beyond the visible.',
        status: 'LIMITLESS ONLINE',
        signature: 'SATORU GOJO',
        chrome: true,
      },
    },
    css: '.awesome-codex-theme body { color: var(--act-text); }',
    artwork: {
      dataUrl: 'data:image/svg+xml;base64,PHN2Zy8+',
    },
    assets: {
      'six-eyes-emblem': {
        dataUrl: 'data:image/png;base64,c2l4LWV5ZXM=',
      },
      'send-infinity': {
        dataUrl: 'data:image/png;base64,aW5maW5pdHk=',
      },
    },
    ...overrides,
  };
}

function runtimeAdapter(overrides = {}) {
  return {
    id: 'codex-26.707',
    css: 'html.awesome-codex-theme { --adapter-sentinel: full-theme; }',
    ...overrides,
  };
}

function createDom() {
  return new JSDOM(
    '<!doctype html><html class="electron-dark keep-root"><head><style id="keep-style">body{margin:0}</style></head><body></body></html>',
    { runScripts: 'outside-only', url: 'app://-/index.html' },
  );
}

describe('theme injection expressions', () => {
  test('applies a namespaced style and root marker', () => {
    const dom = createDom();

    const result = dom.window.eval(buildApplyExpression(runtimeTheme(), runtimeAdapter()));

    const root = dom.window.document.documentElement;
    const style = dom.window.document.getElementById(STYLE_ID);
    expect(result).toEqual({ pass: true, action: 'applied', theme: 'test-theme', adapter: 'codex-26.707' });
    expect(root.classList.contains(APPLY_MARKER)).toBe(true);
    expect(root.classList.contains(EXPERIENCE_MARKER)).toBe(true);
    expect(root.dataset.awesomeCodexTheme).toBe('test-theme');
    expect(root.dataset.awesomeCodexAdapter).toBe('codex-26.707');
    expect(root.dataset.awesomeCodexSurface).toBe('workspace');
    expect(root.style.getPropertyValue('--act-artwork')).toContain('data:image/svg+xml');
    expect(root.style.getPropertyValue('--act-asset-six-eyes-emblem')).toContain('data:image/png');
    expect(root.style.getPropertyValue('--act-asset-send-infinity')).toContain('data:image/png');
    expect(root.style.getPropertyValue('--act-surface-overlay')).toBe('#0B1220F2');
    expect(root.style.getPropertyValue('--act-text-secondary')).toBe('#F4F7FBBF');
    expect(root.style.getPropertyValue('--act-scrollbar-hover')).toBe('#73E2FF78');
    expect(root.style.getPropertyValue('--act-composer')).toBe('#101B2AEF');
    expect(style?.textContent.indexOf('--adapter-sentinel')).toBeLessThan(
      style?.textContent.indexOf('var(--act-text)') ?? -1,
    );
    expect(style?.textContent).toContain('var(--act-text)');
    const chrome = dom.window.document.getElementById(CHROME_ID);
    expect(chrome?.dataset.owner).toBe('awesome-codex-themes');
    expect(chrome?.getAttribute('aria-hidden')).toBe('true');
    expect(chrome?.querySelector('[data-act-copy="brand"]')?.textContent).toBe('LIMITLESS');
    expect(chrome?.querySelector('[data-act-copy="headline"]')?.textContent).toBe('LIMITLESS WORKSPACE');
    expect(chrome?.querySelector('[data-act-copy="status"]')?.textContent).toBe('LIMITLESS ONLINE');
    expect(chrome?.querySelectorAll('.act-experience__particle')).toHaveLength(6);
    expect(dom.window.document.getElementById('keep-style')).not.toBeNull();
  });

  test('classifies only a visibly confirmed home composition as home', async () => {
    const dom = createDom();
    dom.window.eval(buildApplyExpression(runtimeTheme(), runtimeAdapter()));
    const hiddenSignal = dom.window.document.createElement('div');
    hiddenSignal.dataset.testid = 'home-icon';
    hiddenSignal.style.display = 'none';
    dom.window.document.body.appendChild(hiddenSignal);
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
    expect(dom.window.document.documentElement.dataset.awesomeCodexSurface).toBe('workspace');

    const home = dom.window.document.createElement('main');
    home.setAttribute('role', 'main');
    const icon = dom.window.document.createElement('div');
    icon.dataset.testid = 'home-icon';
    const source = dom.window.document.createElement('div');
    source.dataset.feature = 'game-source';
    Object.defineProperty(icon, 'getBoundingClientRect', {
      value: () => ({ width: 24, height: 24, top: 80, left: 80, right: 104, bottom: 104 }),
    });
    Object.defineProperty(source, 'getBoundingClientRect', {
      value: () => ({ width: 600, height: 120, top: 120, left: 300, right: 900, bottom: 240 }),
    });
    Object.defineProperty(home, 'getBoundingClientRect', {
      value: () => ({ width: 900, height: 700, top: 60, left: 240, right: 1140, bottom: 760 }),
    });
    home.append(icon, source);
    dom.window.document.body.appendChild(home);
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    expect(dom.window.document.documentElement.dataset.awesomeCodexSurface).toBe('home');
    expect(home.dataset.awesomeCodexHome).toBe('true');
  });

  test('marks stable component roles without reading conversation copy', async () => {
    const dom = createDom();
    const appHeader = dom.window.document.createElement('header');
    appHeader.className = 'app-header-tint';
    const headerControl = dom.window.document.createElement('button');
    headerControl.setAttribute('aria-label', 'Localized layout control');
    appHeader.appendChild(headerControl);

    const sidebar = dom.window.document.createElement('aside');
    sidebar.className = 'app-shell-left-panel';
    const brandTrigger = dom.window.document.createElement('button');
    brandTrigger.setAttribute('aria-label', 'Switch mode, current mode: Codex');
    brandTrigger.textContent = 'Codex';
    const navItem = dom.window.document.createElement('button');
    navItem.className =
      'relative h-[var(--height-token-row)] px-[var(--padding-row-cell-x,var(--padding-row-x))]';
    navItem.textContent = 'Localized primary destination';
    const domainHeader = dom.window.document.createElement('button');
    domainHeader.className = 'group/section-toggle';
    domainHeader.textContent = 'Localized projects';
    const projectRow = dom.window.document.createElement('div');
    projectRow.className = 'group/folder-row';
    projectRow.setAttribute('aria-label', 'Localized project');
    const taskRow = dom.window.document.createElement('div');
    taskRow.className = 'group relative h-[var(--height-token-row)]';
    const taskDragHandle = dom.window.document.createElement('div');
    taskDragHandle.className = 'cursor-grab active:cursor-grabbing';
    taskRow.appendChild(taskDragHandle);
    const accountTrigger = dom.window.document.createElement('button');
    accountTrigger.setAttribute('aria-label', 'Open profile menu');
    const similarlyNamedProjectControl = dom.window.document.createElement('button');
    similarlyNamedProjectControl.setAttribute('aria-label', 'Personal-Profile project actions');
    const helpTrigger = dom.window.document.createElement('button');
    helpTrigger.setAttribute('aria-label', 'Open help menu');
    const accountIdentity = dom.window.document.createElement('button');
    const avatar = dom.window.document.createElement('img');
    avatar.className = 'icon-sm shrink-0 rounded-full';
    const accountName = dom.window.document.createElement('span');
    accountName.textContent = 'Localized account';
    accountIdentity.append(avatar, accountName);
    sidebar.append(
      brandTrigger,
      navItem,
      domainHeader,
      projectRow,
      taskRow,
      accountTrigger,
      similarlyNamedProjectControl,
      accountIdentity,
      helpTrigger,
    );

    const artifactPanelHost = dom.window.document.createElement('div');
    artifactPanelHost.dataset.pipObstacle = 'thread-summary-panel';
    const artifactPanel = dom.window.document.createElement('div');
    artifactPanel.className = 'rounded-3xl bg-token-dropdown-background';
    const panelScroller = dom.window.document.createElement('div');
    const section = dom.window.document.createElement('section');
    const artifactHeader = dom.window.document.createElement('header');
    artifactHeader.className = 'sticky bg-token-dropdown-background';
    artifactHeader.textContent = 'Localized panel label';
    const panelMore = dom.window.document.createElement('button');
    panelMore.className = 'text-token-conversation-summary-trailing';
    panelMore.textContent = 'Localized additional items';
    section.append(artifactHeader, panelMore);
    panelScroller.appendChild(section);
    artifactPanel.appendChild(panelScroller);
    artifactPanelHost.appendChild(artifactPanel);

    const completedSummary = dom.window.document.createElement('button');
    completedSummary.className =
      'text-size-chat inline-flex items-center gap-1 rounded-md group/activity-header';
    const completedCopy = dom.window.document.createElement('span');
    const completedBody = dom.window.document.createElement('span');
    completedBody.className = 'text-token-conversation-body';
    completedBody.textContent = 'Localized completed state';
    completedCopy.appendChild(completedBody);
    completedSummary.appendChild(completedCopy);

    const runningSummary = dom.window.document.createElement('button');
    runningSummary.className =
      'group/activity-header inline-flex min-w-0 max-w-full self-start items-center gap-1';
    runningSummary.textContent = 'Localized running state';

    const composer = dom.window.document.createElement('div');
    composer.className = 'composer-surface-chrome';
    const attachment = dom.window.document.createElement('button');
    attachment.className = 'aspect-square h-token-button-composer';
    attachment.setAttribute('aria-label', 'Add files and more');
    const access = dom.window.document.createElement('button');
    access.className = 'h-token-button-composer-sm';
    const model = dom.window.document.createElement('button');
    model.className = 'h-token-button-composer';
    const dictation = dom.window.document.createElement('button');
    dictation.className = 'aspect-square h-token-button-composer';
    dictation.setAttribute('aria-label', 'Dictation');
    const primary = dom.window.document.createElement('button');
    primary.className = 'size-token-button-composer bg-token-foreground';
    composer.append(attachment, access, model, dictation, primary);

    dom.window.document.body.append(
      appHeader,
      sidebar,
      artifactPanelHost,
      completedSummary,
      runningSummary,
      composer,
    );
    dom.window.eval(buildApplyExpression(runtimeTheme(), runtimeAdapter()));
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    expect(headerControl.dataset.awesomeCodexHeaderControl).toBe('true');
    expect(brandTrigger.dataset.awesomeCodexSidebarBrand).toBe('true');
    expect(navItem.dataset.awesomeCodexSidebarNav).toBe('01');
    expect(domainHeader.dataset.awesomeCodexDomainHeader).toBe('true');
    expect(projectRow.dataset.awesomeCodexProjectRow).toBe('true');
    expect(projectRow.dataset.awesomeCodexDomainId).toBe('D-01');
    expect(taskRow.dataset.awesomeCodexTaskRow).toBe('true');
    expect(accountTrigger.dataset.awesomeCodexAccountTrigger).toBe('true');
    expect(similarlyNamedProjectControl.dataset.awesomeCodexAccountTrigger).toBeUndefined();
    expect(accountIdentity.dataset.awesomeCodexAccountIdentity).toBe('true');
    expect(helpTrigger.dataset.awesomeCodexHelpTrigger).toBe('true');
    expect(artifactPanel.dataset.awesomeCodexArtifactPanel).toBe('true');
    expect(artifactPanelHost.dataset.awesomeCodexArtifactPanelHost).toBe('true');
    expect(artifactHeader.dataset.awesomeCodexArtifactHeader).toBe('true');
    expect(panelMore.dataset.awesomeCodexPanelMore).toBe('true');
    expect(completedSummary.dataset.awesomeCodexCompletedSummary).toBe('true');
    expect(runningSummary.dataset.awesomeCodexActivityItem).toBe('true');
    expect(attachment.dataset.awesomeCodexComposerControl).toBe('attachment');
    expect(access.dataset.awesomeCodexComposerControl).toBe('access');
    expect(model.dataset.awesomeCodexComposerControl).toBe('model');
    expect(dictation.dataset.awesomeCodexComposerControl).toBe('dictation');
    expect(primary.dataset.awesomeCodexComposerControl).toBe('primary');
  });

  test('tracks whether the Codex artifact panel is actually visible', async () => {
    const dom = createDom();
    const transitionWrapper = dom.window.document.createElement('div');
    transitionWrapper.style.opacity = '1';
    transitionWrapper.style.transform = 'none';
    const artifactPanel = dom.window.document.createElement('div');
    artifactPanel.className = 'rounded-3xl bg-token-dropdown-background';
    Object.defineProperty(artifactPanel, 'getBoundingClientRect', {
      value: () => ({ width: 300, height: 300, top: 50, left: 700, right: 1000, bottom: 350 }),
    });
    const section = dom.window.document.createElement('section');
    const header = dom.window.document.createElement('header');
    header.className = 'bg-token-dropdown-background';
    section.appendChild(header);
    artifactPanel.appendChild(section);
    transitionWrapper.appendChild(artifactPanel);
    dom.window.document.body.appendChild(transitionWrapper);

    dom.window.eval(buildApplyExpression(runtimeTheme(), runtimeAdapter()));
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    const root = dom.window.document.documentElement;
    expect(root.dataset.awesomeCodexArtifactPanelState).toBe('open');

    transitionWrapper.style.opacity = '0';
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
    expect(root.dataset.awesomeCodexArtifactPanelState).toBe('closed');

    transitionWrapper.style.opacity = '1';
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));
    expect(root.dataset.awesomeCodexArtifactPanelState).toBe('open');

    dom.window.eval(buildRemoveExpression());
    expect(root.dataset.awesomeCodexArtifactPanelState).toBeUndefined();
  });

  test('marks the home prompt and inline project as a domain identity', async () => {
    const dom = createDom();
    const home = dom.window.document.createElement('main');
    home.setAttribute('role', 'main');
    const icon = dom.window.document.createElement('div');
    icon.dataset.testid = 'home-icon';
    const prompt = dom.window.document.createElement('div');
    prompt.dataset.feature = 'game-source';
    const project = dom.window.document.createElement('button');
    project.textContent = 'Localized project';
    prompt.appendChild(project);
    const suggestions = dom.window.document.createElement('div');
    suggestions.className = 'group/home-suggestions';
    for (const candidate of [home, icon, prompt, suggestions]) {
      Object.defineProperty(candidate, 'getBoundingClientRect', {
        value: () => ({ width: 600, height: 120, top: 80, left: 300, right: 900, bottom: 200 }),
      });
    }
    home.append(icon, prompt, suggestions);
    dom.window.document.body.appendChild(home);

    dom.window.eval(buildApplyExpression(runtimeTheme(), runtimeAdapter()));
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    expect(dom.window.document.documentElement.dataset.awesomeCodexSurface).toBe('home');
    expect(prompt.dataset.awesomeCodexHomePrompt).toBe('true');
    expect(project.dataset.awesomeCodexDomainMarker).toBe('true');

    dom.window.eval(buildRemoveExpression());
    expect(prompt.dataset.awesomeCodexHomePrompt).toBeUndefined();
    expect(project.dataset.awesomeCodexDomainMarker).toBeUndefined();
  });

  test('classifies the plugin marketplace and its interactive surfaces', async () => {
    const dom = createDom();
    const pluginMarket = dom.window.document.createElement('main');
    pluginMarket.setAttribute('role', 'main');

    const search = dom.window.document.createElement('div');
    search.className =
      'no-drag flex items-center gap-2 border border-token-input-border rounded-full bg-token-input-background/90';
    const searchInput = dom.window.document.createElement('input');
    searchInput.placeholder = '搜索插件';
    search.appendChild(searchInput);

    const installedSection = dom.window.document.createElement('section');
    installedSection.className = 'flex flex-col gap-1';
    const installedHeader = dom.window.document.createElement('div');
    const installedTitle = dom.window.document.createElement('h2');
    installedHeader.appendChild(installedTitle);
    const installedRow = dom.window.document.createElement('div');
    installedRow.className = 'group/plugin-row flex h-11 gap-1 overflow-visible';
    const installedButton = dom.window.document.createElement('button');
    const installedIcon = dom.window.document.createElement('span');
    installedIcon.className = 'rounded-lg border border-token-border-default';
    installedIcon.appendChild(dom.window.document.createElement('img'));
    installedButton.appendChild(installedIcon);
    installedRow.appendChild(installedButton);
    installedSection.append(installedHeader, installedRow);

    const tabs = dom.window.document.createElement('div');
    const publicTab = dom.window.document.createElement('button');
    publicTab.className = 'shrink-0 h-token-button-composer bg-token-foreground/5';
    const personalTab = dom.window.document.createElement('button');
    personalTab.className = 'shrink-0 h-token-button-composer';
    tabs.append(publicTab, personalTab);

    const section = dom.window.document.createElement('section');
    section.className = 'flex flex-col gap-4';
    const sectionHeader = dom.window.document.createElement('div');
    sectionHeader.className = 'border-b border-token-border-light';
    sectionHeader.appendChild(dom.window.document.createElement('h2'));
    const grid = dom.window.document.createElement('div');
    grid.className = 'grid gap-x-7 gap-y-4';
    const card = dom.window.document.createElement('div');
    card.className =
      'flex flex-col gap-2.5 border-token-border/40 rounded-2xl border p-2.5 hover:bg-token-foreground/5';
    card.setAttribute('role', 'button');
    card.tabIndex = 0;
    const cardRow = dom.window.document.createElement('div');
    cardRow.className = 'flex items-center gap-3';
    const cardIcon = dom.window.document.createElement('span');
    cardIcon.className =
      'flex h-10 w-10 items-center justify-center rounded-lg border border-token-border-default';
    cardIcon.appendChild(dom.window.document.createElement('img'));
    const cardContent = dom.window.document.createElement('div');
    cardContent.className = 'flex min-w-0 flex-1 items-center gap-3';
    const more = dom.window.document.createElement('button');
    more.className = 'aspect-square';
    const install = dom.window.document.createElement('button');
    install.className = 'h-token-button-composer border rounded-lg';
    cardContent.append(more, install);
    cardRow.append(cardIcon, cardContent);
    card.appendChild(cardRow);
    grid.appendChild(card);
    section.append(sectionHeader, grid);

    pluginMarket.append(search, installedSection, tabs, section);
    dom.window.document.body.appendChild(pluginMarket);
    dom.window.eval(buildApplyExpression(runtimeTheme(), runtimeAdapter()));
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    expect(dom.window.document.documentElement.dataset.awesomeCodexSurface).toBe('plugins');
    expect(search.dataset.awesomeCodexPluginSearch).toBe('true');
    expect(publicTab.dataset.awesomeCodexPluginTab).toBe('true');
    expect(personalTab.dataset.awesomeCodexPluginTab).toBe('true');
    expect(sectionHeader.dataset.awesomeCodexPluginSectionHeader).toBe('true');
    expect(installedHeader.dataset.awesomeCodexPluginSectionHeader).toBe('true');
    expect(installedButton.dataset.awesomeCodexPluginInstalled).toBe('true');
    expect(installedIcon.dataset.awesomeCodexPluginIcon).toBe('true');
    expect(card.dataset.awesomeCodexPluginCard).toBe('true');
    expect(cardIcon.dataset.awesomeCodexPluginIcon).toBe('true');
    expect(more.dataset.awesomeCodexPluginAction).toBe('menu');
    expect(install.dataset.awesomeCodexPluginAction).toBe('install');

    dom.window.eval(buildRemoveExpression());
    expect(card.dataset.awesomeCodexPluginCard).toBeUndefined();
    expect(install.dataset.awesomeCodexPluginAction).toBeUndefined();
  });

  test('classifies scheduled tasks and marks shared collection roles', async () => {
    const dom = createDom();
    const main = dom.window.document.createElement('main');
    main.setAttribute('role', 'main');

    const search = dom.window.document.createElement('div');
    const searchInput = dom.window.document.createElement('input');
    searchInput.placeholder = '搜索已安排任务';
    search.appendChild(searchInput);

    const tabs = dom.window.document.createElement('div');
    tabs.className = 'hide-scrollbar overflow-x-auto';
    const activeTab = dom.window.document.createElement('button');
    activeTab.className = 'shrink-0 h-token-button-composer bg-token-foreground/5';
    const pausedTab = dom.window.document.createElement('button');
    pausedTab.className = 'shrink-0 h-token-button-composer';
    tabs.append(activeTab, pausedTab);

    const row = dom.window.document.createElement('div');
    row.className = 'automation-row opacity-60';
    const rowButton = dom.window.document.createElement('button');
    row.appendChild(rowButton);
    main.append(search, tabs, row);
    dom.window.document.body.appendChild(main);

    dom.window.eval(buildApplyExpression(runtimeTheme(), runtimeAdapter()));
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    expect(dom.window.document.documentElement.dataset.awesomeCodexSurface).toBe('scheduled');
    expect(search.dataset.awesomeCodexCollectionSearch).toBe('true');
    expect(activeTab.dataset.awesomeCodexCollectionTab).toBe('true');
    expect(pausedTab.dataset.awesomeCodexCollectionTab).toBe('true');
    expect(row.dataset.awesomeCodexCollectionRow).toBe('true');
  });

  test('classifies sites and marks its empty state and primary action', async () => {
    const dom = createDom();
    const main = dom.window.document.createElement('main');
    main.setAttribute('role', 'main');

    const search = dom.window.document.createElement('div');
    const searchInput = dom.window.document.createElement('input');
    searchInput.placeholder = '搜索站点';
    search.appendChild(searchInput);

    const emptyState = dom.window.document.createElement('div');
    emptyState.className = 'flex w-full max-w-xl flex-col items-center justify-center text-center gap-3';
    const createButton = dom.window.document.createElement('button');
    createButton.textContent = '创建新站点';
    emptyState.appendChild(createButton);
    main.append(search, emptyState);
    dom.window.document.body.appendChild(main);

    dom.window.eval(buildApplyExpression(runtimeTheme(), runtimeAdapter()));
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    expect(dom.window.document.documentElement.dataset.awesomeCodexSurface).toBe('sites');
    expect(search.dataset.awesomeCodexCollectionSearch).toBe('true');
    expect(emptyState.dataset.awesomeCodexCollectionEmpty).toBe('true');
    expect(createButton.dataset.awesomeCodexCollectionAction).toBe('primary');
  });

  test('classifies pull requests and marks the loading status', async () => {
    const dom = createDom();
    const main = dom.window.document.createElement('main');
    main.setAttribute('role', 'main');
    const heading = dom.window.document.createElement('h1');
    heading.textContent = 'Pull Request';
    const status = dom.window.document.createElement('div');
    status.setAttribute('role', 'status');
    status.textContent = 'Checking GitHub access';
    main.append(heading, status);
    dom.window.document.body.appendChild(main);

    dom.window.eval(buildApplyExpression(runtimeTheme(), runtimeAdapter()));
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    expect(dom.window.document.documentElement.dataset.awesomeCodexSurface).toBe('pull-requests');
    expect(status.dataset.awesomeCodexCollectionStatus).toBe('true');

    dom.window.eval(buildRemoveExpression());
    expect(status.dataset.awesomeCodexCollectionStatus).toBeUndefined();
  });

  test('classifies a loaded pull-request collection from its search surface', async () => {
    const dom = createDom();
    const search = dom.window.document.createElement('div');
    const searchInput = dom.window.document.createElement('input');
    searchInput.placeholder = '搜索 Pull Request';
    search.appendChild(searchInput);
    const tabs = dom.window.document.createElement('div');
    tabs.className = 'hide-scrollbar overflow-x-auto';
    const activeTab = dom.window.document.createElement('button');
    activeTab.className = 'shrink-0 h-token-button-composer bg-token-foreground/5';
    tabs.appendChild(activeTab);
    const emptyState = dom.window.document.createElement('div');
    emptyState.className =
      'flex w-full max-w-xl flex-col items-center justify-center text-center gap-3 opacity-60';
    emptyState.textContent = '未找到 Pull Request';
    dom.window.document.body.append(search, tabs, emptyState);

    dom.window.eval(buildApplyExpression(runtimeTheme(), runtimeAdapter()));
    await new Promise((resolve) => dom.window.setTimeout(resolve, 0));

    expect(dom.window.document.documentElement.dataset.awesomeCodexSurface).toBe('pull-requests');
    expect(search.dataset.awesomeCodexCollectionSearch).toBe('true');
    expect(activeTab.dataset.awesomeCodexCollectionTab).toBe('true');
    expect(emptyState.dataset.awesomeCodexCollectionEmpty).toBe('true');
  });

  test('is idempotent and replaces the prior payload', () => {
    const dom = createDom();
    dom.window.eval(buildApplyExpression(runtimeTheme(), runtimeAdapter()));

    dom.window.eval(
      buildApplyExpression(
        runtimeTheme({
          manifest: {
            ...runtimeTheme().manifest,
            slug: 'second-theme',
            name: 'Second Theme',
          },
          css: '.awesome-codex-theme body { color: hotpink; }',
        }),
        runtimeAdapter(),
      ),
    );

    expect(dom.window.document.querySelectorAll(`#${STYLE_ID}`)).toHaveLength(1);
    expect(dom.window.document.querySelectorAll(`#${CHROME_ID}`)).toHaveLength(1);
    expect(dom.window.document.getElementById(STYLE_ID)?.textContent).toContain('hotpink');
    expect(dom.window.document.documentElement.dataset.awesomeCodexTheme).toBe('second-theme');
  });

  test('reapply removes auxiliary asset variables that the replacement theme no longer declares', () => {
    const dom = createDom();
    dom.window.eval(buildApplyExpression(runtimeTheme(), runtimeAdapter()));

    dom.window.eval(
      buildApplyExpression(
        runtimeTheme({
          assets: {
            'six-eyes-emblem': {
              dataUrl: 'data:image/png;base64,b25seS1lbWJsZW0=',
            },
          },
        }),
        runtimeAdapter(),
      ),
    );

    const root = dom.window.document.documentElement;
    expect(root.style.getPropertyValue('--act-asset-six-eyes-emblem')).toContain('data:image/png');
    expect(root.style.getPropertyValue('--act-asset-send-infinity')).toBe('');
  });

  test('removes the experience layer when a plain theme replaces it', () => {
    const dom = createDom();
    dom.window.eval(buildApplyExpression(runtimeTheme(), runtimeAdapter()));
    const plainTheme = runtimeTheme({
      manifest: {
        ...runtimeTheme().manifest,
        slug: 'plain-theme',
        experience: undefined,
      },
    });

    dom.window.eval(buildApplyExpression(plainTheme, runtimeAdapter()));

    expect(dom.window.document.getElementById(CHROME_ID)).toBeNull();
    expect(dom.window.document.documentElement.classList.contains(EXPERIENCE_MARKER)).toBe(false);
  });

  test('fails without partial mutation when another owner already uses the chrome id', () => {
    const dom = createDom();
    const unrelated = dom.window.document.createElement('div');
    unrelated.id = CHROME_ID;
    unrelated.dataset.owner = 'another-project';
    unrelated.textContent = 'keep me';
    dom.window.document.body.appendChild(unrelated);

    const result = dom.window.eval(buildApplyExpression(runtimeTheme(), runtimeAdapter()));

    expect(result).toEqual({
      pass: false,
      action: 'conflict',
      theme: 'test-theme',
      adapter: 'codex-26.707',
    });
    expect(dom.window.document.getElementById(CHROME_ID)?.textContent).toBe('keep me');
    expect(dom.window.document.getElementById(STYLE_ID)).toBeNull();
    expect(dom.window.document.documentElement.classList.contains(APPLY_MARKER)).toBe(false);
    expect(dom.window.document.documentElement.dataset.awesomeCodexTheme).toBeUndefined();
  });

  test('drives the renderer color scheme from the theme mode', () => {
    const dom = createDom();
    const lightTheme = runtimeTheme({
      manifest: {
        ...runtimeTheme().manifest,
        mode: 'light',
      },
    });

    dom.window.eval(buildApplyExpression(lightTheme, runtimeAdapter()));

    expect(dom.window.document.documentElement.style.getPropertyValue('--act-color-scheme')).toBe('light');
    dom.window.eval(buildRemoveExpression());
    expect(dom.window.document.documentElement.style.getPropertyValue('--act-color-scheme')).toBe('');
  });

  test('serializes hostile-looking text as inert style text', () => {
    const dom = createDom();
    const css = '.awesome-codex-theme::before { content: "</script> `${notExecuted}"; }';

    dom.window.eval(buildApplyExpression(runtimeTheme({ css }), runtimeAdapter()));

    expect(dom.window.document.getElementById(STYLE_ID)?.textContent).toContain(css);
    expect(dom.window.notExecuted).toBeUndefined();
  });

  test('verification reports the exact active theme', () => {
    const dom = createDom();
    dom.window.eval(buildApplyExpression(runtimeTheme(), runtimeAdapter()));

    const result = dom.window.eval(buildVerificationExpression('test-theme', 'codex-26.707'));

    expect(result).toEqual({
      pass: true,
      theme: 'test-theme',
      adapter: 'codex-26.707',
      stylePresent: true,
      chromePresent: true,
    });
  });

  test('removes only project-owned state', () => {
    const dom = createDom();
    dom.window.eval(buildApplyExpression(runtimeTheme(), runtimeAdapter()));
    const header = dom.window.document.createElement('header');
    header.className = 'app-header-tint';
    const headerControl = dom.window.document.createElement('button');
    headerControl.dataset.awesomeCodexHeaderControl = 'true';
    header.appendChild(headerControl);
    const legacyActivityMarker = dom.window.document.createElement('button');
    legacyActivityMarker.dataset.awesomeCodexActivitySummary = 'true';
    dom.window.document.body.append(header, legacyActivityMarker);

    const result = dom.window.eval(buildRemoveExpression());

    const root = dom.window.document.documentElement;
    expect(result).toEqual({ pass: true, action: 'removed' });
    expect(root.classList.contains(APPLY_MARKER)).toBe(false);
    expect(root.classList.contains(EXPERIENCE_MARKER)).toBe(false);
    expect(root.classList.contains('keep-root')).toBe(true);
    expect(root.dataset.awesomeCodexTheme).toBeUndefined();
    expect(root.dataset.awesomeCodexAdapter).toBeUndefined();
    expect(root.dataset.awesomeCodexSurface).toBeUndefined();
    expect(root.style.getPropertyValue('--act-artwork')).toBe('');
    expect(root.style.getPropertyValue('--act-asset-six-eyes-emblem')).toBe('');
    expect(root.style.getPropertyValue('--act-asset-send-infinity')).toBe('');
    expect(root.style.getPropertyValue('--act-surface-overlay')).toBe('');
    expect(root.style.getPropertyValue('--act-composer')).toBe('');
    expect(dom.window.document.getElementById(STYLE_ID)).toBeNull();
    expect(dom.window.document.getElementById(CHROME_ID)).toBeNull();
    expect(dom.window.document.getElementById('keep-style')).not.toBeNull();
    expect(dom.window.document.querySelector('[data-awesome-codex-artifact-panel]')).toBeNull();
    expect(dom.window.document.querySelector('[data-awesome-codex-artifact-panel-host]')).toBeNull();
    expect(dom.window.document.querySelector('[data-awesome-codex-artifact-header]')).toBeNull();
    expect(dom.window.document.querySelector('[data-awesome-codex-panel-more]')).toBeNull();
    expect(dom.window.document.querySelector('[data-awesome-codex-completed-summary]')).toBeNull();
    expect(dom.window.document.querySelector('[data-awesome-codex-activity-item]')).toBeNull();
    expect(dom.window.document.querySelector('[data-awesome-codex-header-control]')).toBeNull();
    expect(dom.window.document.querySelector('[data-awesome-codex-sidebar-brand]')).toBeNull();
    expect(dom.window.document.querySelector('[data-awesome-codex-sidebar-nav]')).toBeNull();
    expect(dom.window.document.querySelector('[data-awesome-codex-domain-header]')).toBeNull();
    expect(dom.window.document.querySelector('[data-awesome-codex-project-row]')).toBeNull();
    expect(dom.window.document.querySelector('[data-awesome-codex-domain-id]')).toBeNull();
    expect(dom.window.document.querySelector('[data-awesome-codex-task-row]')).toBeNull();
    expect(dom.window.document.querySelector('[data-awesome-codex-account-trigger]')).toBeNull();
    expect(dom.window.document.querySelector('[data-awesome-codex-account-identity]')).toBeNull();
    expect(dom.window.document.querySelector('[data-awesome-codex-help-trigger]')).toBeNull();
    expect(dom.window.document.querySelector('[data-awesome-codex-home-prompt]')).toBeNull();
    expect(dom.window.document.querySelector('[data-awesome-codex-domain-marker]')).toBeNull();
    expect(dom.window.document.querySelector('[data-awesome-codex-composer-control]')).toBeNull();
    expect(dom.window.document.querySelector('[data-awesome-codex-activity-summary]')).toBeNull();
  });

  test('restore leaves an unrelated theme injector untouched', () => {
    const dom = createDom();
    const unrelated = dom.window.document.createElement('style');
    unrelated.id = 'cat-theme-style';
    unrelated.textContent = 'body { opacity: 1; }';
    dom.window.document.head.appendChild(unrelated);
    dom.window.eval(buildApplyExpression(runtimeTheme(), runtimeAdapter()));

    dom.window.eval(buildRemoveExpression());

    expect(dom.window.document.getElementById('cat-theme-style')?.textContent).toContain('opacity');
  });
});
