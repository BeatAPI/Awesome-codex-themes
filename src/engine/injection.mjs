import { SEMANTIC_COLOR_ROLES } from './theme.mjs';

export const STYLE_ID = 'awesome-codex-theme-style';
export const APPLY_MARKER = 'awesome-codex-theme';
export const CHROME_ID = 'awesome-codex-theme-chrome';
export const EXPERIENCE_MARKER = 'awesome-codex-theme-experience';
const OWNER = 'awesome-codex-themes';
const SURFACE_OBSERVER_KEY = '__awesomeCodexThemeSurfaceObserver';
const AUXILIARY_ASSET_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const AUXILIARY_ASSET_VARIABLE_PREFIX = '--act-asset-';

function roleToVariable(role) {
  return `--act-${role.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`;
}

export const PALETTE_VARIABLES = Object.freeze(
  Object.fromEntries(SEMANTIC_COLOR_ROLES.map((role) => [role, roleToVariable(role)])),
);

const OWNED_VARIABLES = Object.freeze([
  '--act-artwork',
  '--act-color-scheme',
  ...Object.values(PALETTE_VARIABLES),
]);

function serializeForExpression(value) {
  return JSON.stringify(value)
    .replaceAll('<', '\\u003c')
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}

function runtimePayload(theme, adapter) {
  const { manifest, css, artwork } = theme ?? {};
  if (
    !manifest ||
    typeof manifest.slug !== 'string' ||
    !manifest.palette ||
    typeof css !== 'string' ||
    typeof artwork?.dataUrl !== 'string'
  ) {
    throw new TypeError('A fully loaded theme package is required.');
  }
  if (
    !adapter ||
    typeof adapter.id !== 'string' ||
    adapter.id.trim() === '' ||
    typeof adapter.css !== 'string' ||
    adapter.css.trim() === ''
  ) {
    throw new TypeError('A fully loaded Codex adapter is required.');
  }
  if (!['dark', 'light', 'system'].includes(manifest.mode)) {
    throw new TypeError('A validated theme mode is required.');
  }
  const variables = Object.fromEntries(
    Object.entries(PALETTE_VARIABLES).map(([role, variable]) => {
      const value = manifest.palette[role];
      if (typeof value !== 'string' || value === '') {
        throw new TypeError(`Theme palette role is missing: ${role}`);
      }
      return [variable, value];
    }),
  );
  const assetVariables = Object.fromEntries(
    Object.entries(theme.assets ?? {}).map(([name, asset]) => {
      if (
        !AUXILIARY_ASSET_NAME_PATTERN.test(name) ||
        !asset ||
        typeof asset.dataUrl !== 'string' ||
        !asset.dataUrl.startsWith('data:image/')
      ) {
        throw new TypeError(`Theme runtime asset is invalid: ${name}`);
      }
      return [`${AUXILIARY_ASSET_VARIABLE_PREFIX}${name}`, `url("${asset.dataUrl}")`];
    }),
  );
  return {
    slug: manifest.slug,
    colorScheme: manifest.mode === 'system' ? 'light dark' : manifest.mode,
    css,
    adapterId: adapter.id,
    adapterCss: adapter.css,
    artworkDataUrl: artwork.dataUrl,
    variables,
    assetVariables,
    experience: manifest.experience?.chrome
      ? {
          brand: manifest.experience.brand,
          eyebrow: manifest.experience.eyebrow,
          headline: manifest.experience.headline,
          tagline: manifest.experience.tagline,
          status: manifest.experience.status,
          signature: manifest.experience.signature,
        }
      : null,
  };
}

export function buildApplyExpression(theme, adapter) {
  const payload = serializeForExpression(runtimePayload(theme, adapter));
  return `(() => {
    const payload = ${payload};
    const root = document.documentElement;
    if (!root || !document.head) return { pass: false, action: 'applied', theme: payload.slug, adapter: payload.adapterId };
    const currentChrome = document.getElementById(${serializeForExpression(CHROME_ID)});
    if (payload.experience && currentChrome && currentChrome.dataset.owner !== ${serializeForExpression(OWNER)}) {
      return { pass: false, action: 'conflict', theme: payload.slug, adapter: payload.adapterId };
    }

    let style = document.getElementById(${serializeForExpression(STYLE_ID)});
    if (!style) {
      style = document.createElement('style');
      style.id = ${serializeForExpression(STYLE_ID)};
      style.dataset.owner = ${serializeForExpression(OWNER)};
      document.head.appendChild(style);
    }
    style.dataset.adapter = payload.adapterId;
    style.textContent = payload.adapterCss + '\\n\\n' + payload.css;

    root.classList.add(${serializeForExpression(APPLY_MARKER)});
    root.dataset.awesomeCodexTheme = payload.slug;
    root.dataset.awesomeCodexAdapter = payload.adapterId;
    root.style.setProperty('--act-artwork', 'url("' + payload.artworkDataUrl + '")');
    root.style.setProperty('--act-color-scheme', payload.colorScheme);
    for (let index = root.style.length - 1; index >= 0; index -= 1) {
      const variable = root.style.item(index);
      if (variable.startsWith(${serializeForExpression(AUXILIARY_ASSET_VARIABLE_PREFIX)})) {
        root.style.removeProperty(variable);
      }
    }
    for (const [variable, value] of Object.entries(payload.variables)) {
      root.style.setProperty(variable, value);
    }
    for (const [variable, value] of Object.entries(payload.assetVariables)) {
      root.style.setProperty(variable, value);
    }

    if (payload.experience && document.body) {
      const chrome = currentChrome ?? document.createElement('div');
      chrome.id = ${serializeForExpression(CHROME_ID)};
      chrome.className = 'act-experience';
      chrome.dataset.owner = ${serializeForExpression(OWNER)};
      chrome.setAttribute('aria-hidden', 'true');
      chrome.replaceChildren();

      const makeCopy = (className, key, value) => {
        const node = document.createElement('span');
        node.className = className;
        node.dataset.actCopy = key;
        node.textContent = value;
        return node;
      };

      const identity = document.createElement('div');
      identity.className = 'act-experience__identity';
      identity.append(
        makeCopy('act-experience__eyebrow', 'eyebrow', payload.experience.eyebrow),
        makeCopy('act-experience__brand', 'brand', payload.experience.brand),
        makeCopy('act-experience__headline', 'headline', payload.experience.headline),
        makeCopy('act-experience__tagline', 'tagline', payload.experience.tagline),
        makeCopy('act-experience__signature', 'signature', payload.experience.signature),
      );

      const status = document.createElement('div');
      status.className = 'act-experience__status';
      const statusDot = document.createElement('i');
      statusDot.className = 'act-experience__status-dot';
      status.append(statusDot, makeCopy('act-experience__status-copy', 'status', payload.experience.status));

      const orbit = document.createElement('div');
      orbit.className = 'act-experience__orbit';
      const particles = document.createElement('div');
      particles.className = 'act-experience__particles';
      for (let index = 0; index < 6; index += 1) {
        const particle = document.createElement('i');
        particle.className = 'act-experience__particle';
        particle.style.setProperty('--act-particle-index', String(index));
        particles.appendChild(particle);
      }

      chrome.append(identity, status, orbit, particles);
      if (!currentChrome) document.body.appendChild(chrome);
      root.classList.add(${serializeForExpression(EXPERIENCE_MARKER)});
    } else {
      if (currentChrome?.dataset.owner === ${serializeForExpression(OWNER)}) currentChrome.remove();
      root.classList.remove(${serializeForExpression(EXPERIENCE_MARKER)});
    }

    const isVisible = (node) => {
      if (!(node instanceof Element)) return false;
      const rect = node.getBoundingClientRect();
      const computed = getComputedStyle(node);
      return rect.width > 1 && rect.height > 1 && computed.display !== 'none' && computed.visibility !== 'hidden' && computed.opacity !== '0';
    };
    const isEffectivelyVisible = (node) => {
      if (!(node instanceof Element)) return false;
      const rect = node.getBoundingClientRect();
      if (
        rect.width <= 1 ||
        rect.height <= 1 ||
        rect.right <= 0 ||
        rect.left >= window.innerWidth ||
        rect.bottom <= 0 ||
        rect.top >= window.innerHeight
      ) return false;
      for (let current = node; current && current !== document; current = current.parentElement) {
        const computed = getComputedStyle(current);
        if (
          computed.display === 'none' ||
          computed.visibility === 'hidden' ||
          Number.parseFloat(computed.opacity || '1') < 0.01
        ) return false;
      }
      return true;
    };
    const findPluginSearchInput = () => {
      for (const candidate of document.querySelectorAll('input[placeholder]')) {
        const placeholder = candidate.getAttribute('placeholder') || '';
        if (/search (?:plugins|skills)|搜索(?:插件|技能)/i.test(placeholder)) return candidate;
      }
      return null;
    };
    const findScheduledSearchInput = () => {
      for (const candidate of document.querySelectorAll('input[placeholder]')) {
        const placeholder = candidate.getAttribute('placeholder') || '';
        if (/search scheduled|搜索已安排/i.test(placeholder)) return candidate;
      }
      return null;
    };
    const findSitesSearchInput = () => {
      for (const candidate of document.querySelectorAll('input[placeholder]')) {
        const placeholder = candidate.getAttribute('placeholder') || '';
        if (/search sites|搜索站点/i.test(placeholder)) return candidate;
      }
      return null;
    };
    const findPullRequestsSearchInput = () => {
      for (const candidate of document.querySelectorAll('input[placeholder]')) {
        const placeholder = candidate.getAttribute('placeholder') || '';
        if (/pull requests?|拉取请求/i.test(placeholder)) return candidate;
      }
      return null;
    };
    const findPullRequestsRoot = () => {
      for (const heading of document.querySelectorAll('h1')) {
        const copy = heading.textContent?.trim() || '';
        if (/^pull requests?$/i.test(copy) || /^拉取请求$/.test(copy)) {
          return (
            heading.closest('[role="main"]') ||
            heading.closest('.app-shell-main-content-viewport') ||
            heading.closest('.app-shell-main-content-frame') ||
            document.body
          );
        }
      }
      return null;
    };
    const closestMainSurface = (candidate) => {
      if (!candidate) return null;
      return (
        candidate.closest?.('[role="main"]') ||
        candidate.closest?.('.app-shell-main-content-viewport') ||
        candidate.closest?.('.app-shell-main-content-frame') ||
        document.body
      );
    };
    const updateComponentRoles = () => {
      const roleKeys = [
        'awesomeCodexArtifactPanel',
        'awesomeCodexArtifactPanelHost',
        'awesomeCodexArtifactHeader',
        'awesomeCodexPanelMore',
        'awesomeCodexCompletedSummary',
        'awesomeCodexActivityItem',
        'awesomeCodexActivitySummary',
        'awesomeCodexHeaderControl',
        'awesomeCodexSidebarBrand',
        'awesomeCodexSidebarNav',
        'awesomeCodexDomainHeader',
        'awesomeCodexProjectRow',
        'awesomeCodexDomainId',
        'awesomeCodexTaskRow',
        'awesomeCodexAccountTrigger',
        'awesomeCodexAccountIdentity',
        'awesomeCodexHelpTrigger',
        'awesomeCodexHomePrompt',
        'awesomeCodexDomainMarker',
        'awesomeCodexComposerControl',
        'awesomeCodexPluginSearch',
        'awesomeCodexPluginTab',
        'awesomeCodexPluginSectionHeader',
        'awesomeCodexPluginInstalled',
        'awesomeCodexPluginCard',
        'awesomeCodexPluginIcon',
        'awesomeCodexPluginAction',
        'awesomeCodexCollectionSearch',
        'awesomeCodexCollectionTab',
        'awesomeCodexCollectionSectionHeader',
        'awesomeCodexCollectionRow',
        'awesomeCodexCollectionEmpty',
        'awesomeCodexCollectionStatus',
        'awesomeCodexCollectionAction',
      ];
      const desiredRoles = new Map(roleKeys.map((roleKey) => [roleKey, new Map()]));
      const markRole = (candidate, roleKey, value = 'true') => {
        if (candidate && desiredRoles.has(roleKey)) {
          desiredRoles.get(roleKey).set(candidate, String(value));
        }
      };

      for (const candidate of document.querySelectorAll('.bg-token-dropdown-background:not(header)')) {
        const headers = candidate.querySelectorAll('section > header.bg-token-dropdown-background');
        if (headers.length === 0) continue;
        markRole(candidate, 'awesomeCodexArtifactPanel');
        const panelHost =
          candidate.closest('[data-pip-obstacle="thread-summary-panel"]') || candidate.parentElement;
        markRole(panelHost, 'awesomeCodexArtifactPanelHost');
        for (const header of headers) markRole(header, 'awesomeCodexArtifactHeader');
        for (const panelMore of candidate.querySelectorAll('.text-token-conversation-summary-trailing')) {
          markRole(panelMore, 'awesomeCodexPanelMore');
        }
      }

      for (const candidate of document.querySelectorAll('button')) {
        const isCompletedSummary = Boolean(
          candidate.matches('.text-size-chat.inline-flex.items-center.gap-1') &&
          candidate.querySelector('.text-token-conversation-body'),
        );
        if (isCompletedSummary) {
          markRole(candidate, 'awesomeCodexCompletedSummary');
        } else if (candidate.classList.contains('group/activity-header')) {
          markRole(candidate, 'awesomeCodexActivityItem');
        }
      }

      for (const candidate of document.querySelectorAll('.app-header-tint :is(button, [role="button"])')) {
        markRole(candidate, 'awesomeCodexHeaderControl');
      }

      for (const candidate of document.querySelectorAll('[class~="group/folder-row"]')) {
        markRole(candidate, 'awesomeCodexProjectRow');
      }
      for (const [index, candidate] of [
        ...document.querySelectorAll('[class~="group/folder-row"]'),
      ].entries()) {
        markRole(candidate, 'awesomeCodexDomainId', 'D-' + String(index + 1).padStart(2, '0'));
      }
      for (const dragHandle of document.querySelectorAll('[class~="cursor-grab"]')) {
        const taskRow = dragHandle.closest('div.group.relative') || dragHandle.parentElement;
        markRole(taskRow, 'awesomeCodexTaskRow');
      }

      for (const sidebar of document.querySelectorAll('.app-shell-left-panel')) {
        const domainHeaders = [...sidebar.querySelectorAll('[class~="group/section-toggle"]')];
        for (const candidate of domainHeaders) {
          markRole(candidate, 'awesomeCodexDomainHeader');
        }
        const firstDomainHeader = domainHeaders[0] ?? null;
        for (const candidate of sidebar.querySelectorAll('button')) {
          const label = (candidate.getAttribute('aria-label') || '').toLocaleLowerCase();
          if (/switch mode|切换模式/.test(label)) {
            markRole(candidate, 'awesomeCodexSidebarBrand');
          }
          if (candidate.querySelector('img.rounded-full')) {
            markRole(candidate, 'awesomeCodexAccountIdentity');
            markRole(candidate, 'awesomeCodexAccountTrigger');
          }
        }
        for (const candidate of sidebar.querySelectorAll('button')) {
          if (candidate === firstDomainHeader) break;
          if (candidate.classList.contains('h-[var(--height-token-row)]')) {
            const currentIndex = desiredRoles.get('awesomeCodexSidebarNav').size + 1;
            markRole(candidate, 'awesomeCodexSidebarNav', String(currentIndex).padStart(2, '0'));
          }
        }
        for (const candidate of sidebar.querySelectorAll('button[aria-label], [role="button"][aria-label]')) {
          const label = (candidate.getAttribute('aria-label') || '').toLocaleLowerCase();
          if (
            label.includes('profile menu') ||
            label.includes('account menu') ||
            label.includes('个人资料菜单') ||
            label.includes('账户菜单')
          ) {
            markRole(candidate, 'awesomeCodexAccountTrigger');
          } else if (label.includes('help') || label.includes('帮助')) {
            markRole(candidate, 'awesomeCodexHelpTrigger');
          }
        }
      }

      const homePrompt = document.querySelector(
        '[data-awesome-codex-home="true"] [data-feature="game-source"]',
      );
      if (homePrompt) {
        markRole(homePrompt, 'awesomeCodexHomePrompt');
        const domainMarker = homePrompt.querySelector('button');
        markRole(domainMarker, 'awesomeCodexDomainMarker');
      }

      for (const composer of document.querySelectorAll('.composer-surface-chrome')) {
        for (const candidate of composer.querySelectorAll('button')) {
          const label = (candidate.getAttribute('aria-label') || '').toLocaleLowerCase();
          const isSquare = candidate.classList.contains('aspect-square');
          let control = '';
          if (
            candidate.matches('[data-testid="composer-send-button"], .composer-send-button') ||
            candidate.classList.contains('size-token-button-composer') ||
            candidate.classList.contains('bg-token-foreground')
          ) {
            control = 'primary';
          } else if (label.includes('dictation') || label.includes('听写')) {
            control = 'dictation';
          } else if (
            label.includes('add files') ||
            label.includes('attach') ||
            label.includes('添加文件') ||
            label.includes('附件')
          ) {
            control = 'attachment';
          } else if (candidate.classList.contains('h-token-button-composer-sm')) {
            control = 'access';
          } else if (candidate.classList.contains('h-token-button-composer') && !isSquare) {
            control = 'model';
          }
          if (control) markRole(candidate, 'awesomeCodexComposerControl', control);
        }
      }

      const pluginSearchInput = findPluginSearchInput();
      if (pluginSearchInput) {
        const pluginRoot = closestMainSurface(pluginSearchInput);
        const searchSurface = pluginSearchInput.parentElement;
        if (searchSurface) {
          markRole(searchSurface, 'awesomeCodexPluginSearch');
          markRole(searchSurface, 'awesomeCodexCollectionSearch');
        }

        for (const heading of pluginRoot.querySelectorAll('h2')) {
          if (heading.parentElement) {
            markRole(heading.parentElement, 'awesomeCodexPluginSectionHeader');
            markRole(heading.parentElement, 'awesomeCodexCollectionSectionHeader');
          }
        }

        for (const installedRow of pluginRoot.querySelectorAll('[class~="group/plugin-row"]')) {
          for (const button of installedRow.querySelectorAll(':scope > button')) {
            markRole(button, 'awesomeCodexPluginInstalled');
            markRole(button, 'awesomeCodexCollectionRow');
            const icon = button.querySelector('img')?.parentElement;
            markRole(icon, 'awesomeCodexPluginIcon');
          }
        }

        for (const candidate of pluginRoot.querySelectorAll('button.shrink-0')) {
          if (
            candidate.classList.contains('h-token-button-composer') &&
            !candidate.closest('[data-awesome-codex-plugin-card="true"]') &&
            !candidate.closest('[class~="group/plugin-row"]')
          ) {
            markRole(candidate, 'awesomeCodexPluginTab');
            markRole(candidate, 'awesomeCodexCollectionTab');
          }
        }

        for (const candidate of pluginRoot.querySelectorAll('div[role="button"][tabindex="0"]')) {
          const iconImage = candidate.querySelector('img');
          const contentRow = candidate.querySelector(':scope > .flex.items-center.gap-3');
          if (!iconImage || !contentRow) continue;
          markRole(candidate, 'awesomeCodexPluginCard');
          markRole(candidate, 'awesomeCodexCollectionRow');
          const icon = iconImage.parentElement;
          markRole(icon, 'awesomeCodexPluginIcon');
          for (const action of candidate.querySelectorAll('button')) {
            markRole(
              action,
              'awesomeCodexPluginAction',
              action.classList.contains('aspect-square') ? 'menu' : 'install',
            );
          }
        }
      }

      const scheduledSearchInput = findScheduledSearchInput();
      if (scheduledSearchInput) {
        const scheduledRoot = closestMainSurface(scheduledSearchInput);
        markRole(scheduledSearchInput.parentElement, 'awesomeCodexCollectionSearch');
        for (const candidate of scheduledRoot.querySelectorAll('button.shrink-0.h-token-button-composer')) {
          markRole(candidate, 'awesomeCodexCollectionTab');
        }
        for (const candidate of scheduledRoot.querySelectorAll('.automation-row')) {
          markRole(candidate, 'awesomeCodexCollectionRow');
        }
        for (const heading of scheduledRoot.querySelectorAll('h2')) {
          markRole(heading.parentElement, 'awesomeCodexCollectionSectionHeader');
        }
      }

      const sitesSearchInput = findSitesSearchInput();
      if (sitesSearchInput) {
        const sitesRoot = closestMainSurface(sitesSearchInput);
        markRole(sitesSearchInput.parentElement, 'awesomeCodexCollectionSearch');
        const emptyState = sitesRoot.querySelector('.max-w-xl.flex-col.items-center');
        if (emptyState) {
          markRole(emptyState, 'awesomeCodexCollectionEmpty');
          const action = emptyState.querySelector('button');
          markRole(action, 'awesomeCodexCollectionAction', 'primary');
        }
      }

      const pullRequestsSearchInput = findPullRequestsSearchInput();
      const pullRequestsRoot =
        closestMainSurface(pullRequestsSearchInput) || findPullRequestsRoot();
      if (pullRequestsRoot) {
        markRole(pullRequestsSearchInput?.parentElement, 'awesomeCodexCollectionSearch');
        for (const candidate of pullRequestsRoot.querySelectorAll('button.shrink-0.h-token-button-composer')) {
          markRole(candidate, 'awesomeCodexCollectionTab');
        }
        const status = pullRequestsRoot.querySelector('[role="status"]');
        markRole(status, 'awesomeCodexCollectionStatus');
        const emptyState = pullRequestsRoot.querySelector('.max-w-xl.flex-col.items-center');
        markRole(emptyState, 'awesomeCodexCollectionEmpty');
      }

      for (const roleKey of roleKeys) {
        const desired = desiredRoles.get(roleKey);
        const attribute = 'data-' + roleKey.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
        for (const candidate of document.querySelectorAll('[' + attribute + ']')) {
          if (!desired.has(candidate)) delete candidate.dataset[roleKey];
        }
        for (const [candidate, value] of desired) {
          if (candidate.dataset[roleKey] !== value) candidate.dataset[roleKey] = value;
        }
      }
    };
    const updateSurface = () => {
      const pluginSearchInput = findPluginSearchInput();
      const scheduledSearchInput = findScheduledSearchInput();
      const sitesSearchInput = findSitesSearchInput();
      const pullRequestsSearchInput = findPullRequestsSearchInput();
      const pullRequestsRoot = findPullRequestsRoot();
      const retainHomeStructure = root.dataset.awesomeCodexSurface === 'home';
      let home = null;
      if (
        !pluginSearchInput &&
        !scheduledSearchInput &&
        !sitesSearchInput &&
        !pullRequestsSearchInput &&
        !pullRequestsRoot
      ) {
        for (const candidate of document.querySelectorAll('[role="main"]')) {
          const icon = candidate.querySelector('[data-testid="home-icon"]');
          const source = candidate.querySelector('[data-feature="game-source"]');
          const suggestions = candidate.querySelector('[class~="group/home-suggestions"]');
          const hasIdentity = isVisible(icon) && isVisible(source);
          const hasActions = isVisible(source) && isVisible(suggestions);
          const hasHomeStructure = Boolean(source && (icon || suggestions));
          if (
            isVisible(candidate) &&
            (hasIdentity || hasActions || (retainHomeStructure && hasHomeStructure))
          ) {
            home = candidate;
            break;
          }
        }
      }
      for (const candidate of document.querySelectorAll('[data-awesome-codex-home]')) {
        if (candidate !== home) delete candidate.dataset.awesomeCodexHome;
      }
      if (home && home.dataset.awesomeCodexHome !== 'true') home.dataset.awesomeCodexHome = 'true';
      const nextSurface = pluginSearchInput
        ? 'plugins'
        : scheduledSearchInput
          ? 'scheduled'
          : sitesSearchInput
            ? 'sites'
            : pullRequestsSearchInput || pullRequestsRoot
              ? 'pull-requests'
              : home
                ? 'home'
                : 'workspace';
      if (root.dataset.awesomeCodexSurface !== nextSurface) {
        root.dataset.awesomeCodexSurface = nextSurface;
      }
      updateComponentRoles();
      const artifactPanels = [...document.querySelectorAll('[data-awesome-codex-artifact-panel="true"]')];
      if (artifactPanels.length === 0) {
        delete root.dataset.awesomeCodexArtifactPanelState;
      } else {
        const nextPanelState = artifactPanels.some(isEffectivelyVisible)
          ? 'open'
          : 'closed';
        if (root.dataset.awesomeCodexArtifactPanelState !== nextPanelState) {
          root.dataset.awesomeCodexArtifactPanelState = nextPanelState;
        }
      }
    };
    updateSurface();
    const previousObserver = window[${serializeForExpression(SURFACE_OBSERVER_KEY)}];
    previousObserver?.disconnect?.();
    if (typeof MutationObserver === 'function' && document.body) {
      let updateQueued = false;
      const observer = new MutationObserver(() => {
        if (updateQueued) return;
        updateQueued = true;
        queueMicrotask(() => {
          updateQueued = false;
          updateSurface();
        });
      });
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class', 'style', 'aria-pressed'],
      });
      window[${serializeForExpression(SURFACE_OBSERVER_KEY)}] = observer;
    }

    return { pass: true, action: 'applied', theme: payload.slug, adapter: payload.adapterId };
  })()`;
}

export function buildVerificationExpression(expectedSlug, expectedAdapterId) {
  const slug = serializeForExpression(expectedSlug);
  const adapterId = serializeForExpression(expectedAdapterId);
  return `(() => {
    const root = document.documentElement;
    const stylePresent = Boolean(document.getElementById(${serializeForExpression(STYLE_ID)}));
    const chromePresent = document.getElementById(${serializeForExpression(CHROME_ID)})?.dataset?.owner === ${serializeForExpression(OWNER)};
    const theme = root?.dataset?.awesomeCodexTheme ?? null;
    const adapter = root?.dataset?.awesomeCodexAdapter ?? null;
    return {
      pass: Boolean(root?.classList?.contains(${serializeForExpression(APPLY_MARKER)}) && stylePresent && theme === ${slug} && adapter === ${adapterId}),
      theme,
      adapter,
      stylePresent,
      chromePresent,
    };
  })()`;
}

export function buildRemoveExpression() {
  const variables = serializeForExpression(OWNED_VARIABLES);
  return `(() => {
    const root = document.documentElement;
    const observer = window[${serializeForExpression(SURFACE_OBSERVER_KEY)}];
    observer?.disconnect?.();
    delete window[${serializeForExpression(SURFACE_OBSERVER_KEY)}];
    document.getElementById(${serializeForExpression(STYLE_ID)})?.remove();
    const chrome = document.getElementById(${serializeForExpression(CHROME_ID)});
    if (chrome?.dataset.owner === ${serializeForExpression(OWNER)}) chrome.remove();
    if (root) {
      root.classList.remove(${serializeForExpression(APPLY_MARKER)});
      root.classList.remove(${serializeForExpression(EXPERIENCE_MARKER)});
      delete root.dataset.awesomeCodexTheme;
      delete root.dataset.awesomeCodexAdapter;
      delete root.dataset.awesomeCodexSurface;
      delete root.dataset.awesomeCodexArtifactPanelState;
      for (const variable of ${variables}) root.style.removeProperty(variable);
      for (let index = root.style.length - 1; index >= 0; index -= 1) {
        const variable = root.style.item(index);
        if (variable.startsWith(${serializeForExpression(AUXILIARY_ASSET_VARIABLE_PREFIX)})) {
          root.style.removeProperty(variable);
        }
      }
    }
    for (const candidate of document.querySelectorAll('[data-awesome-codex-home]')) {
      delete candidate.dataset.awesomeCodexHome;
    }
    const roleKeys = [
      'awesomeCodexArtifactPanel',
      'awesomeCodexArtifactPanelHost',
      'awesomeCodexArtifactHeader',
      'awesomeCodexPanelMore',
      'awesomeCodexCompletedSummary',
      'awesomeCodexActivityItem',
      'awesomeCodexActivitySummary',
      'awesomeCodexHeaderControl',
      'awesomeCodexSidebarBrand',
      'awesomeCodexSidebarNav',
      'awesomeCodexDomainHeader',
      'awesomeCodexProjectRow',
      'awesomeCodexDomainId',
      'awesomeCodexTaskRow',
      'awesomeCodexAccountTrigger',
      'awesomeCodexAccountIdentity',
      'awesomeCodexHelpTrigger',
      'awesomeCodexHomePrompt',
      'awesomeCodexDomainMarker',
      'awesomeCodexComposerControl',
      'awesomeCodexPluginSearch',
      'awesomeCodexPluginTab',
      'awesomeCodexPluginSectionHeader',
      'awesomeCodexPluginInstalled',
      'awesomeCodexPluginCard',
      'awesomeCodexPluginIcon',
      'awesomeCodexPluginAction',
      'awesomeCodexCollectionSearch',
      'awesomeCodexCollectionTab',
      'awesomeCodexCollectionSectionHeader',
      'awesomeCodexCollectionRow',
      'awesomeCodexCollectionEmpty',
      'awesomeCodexCollectionStatus',
      'awesomeCodexCollectionAction',
    ];
    for (const roleKey of roleKeys) {
      const attribute = 'data-' + roleKey.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase());
      for (const candidate of document.querySelectorAll('[' + attribute + ']')) {
        delete candidate.dataset[roleKey];
      }
    }
    return {
      pass: !document.getElementById(${serializeForExpression(STYLE_ID)}) && !document.getElementById(${serializeForExpression(CHROME_ID)}) && !root?.classList?.contains(${serializeForExpression(APPLY_MARKER)}),
      action: 'removed',
    };
  })()`;
}
