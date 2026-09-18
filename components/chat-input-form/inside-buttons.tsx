'use client';

import type React from 'react';
import { Fragment, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Switch } from '@/components/ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  X,
  BookOpen,
  Archive,
  Check,
  ChevronDown,
  Terminal,
  Monitor,
  Sparkles,
  Loader2,
} from 'lucide-react';
import type { EffectiveAgentSkill } from '@iblai/iblai-js/data-layer';
import { toast } from 'sonner';
import { DeepSearchIcon, CanvasIcon } from '@/components/icons/svg-icons';
import {
  coworkPrefSet,
  readCoworkApprovals,
  writeCoworkApprovals,
  type CoworkApprovals,
} from '@/lib/cowork-approvals';
import { TOOLS, hasRemoteAiConfig } from '@iblai/iblai-js/web-utils';
import {
  useCuaDriver,
  isCoworkEnabled,
  setCoworkEnabled,
  isLocalLLMEnabled,
  getLocalLLMModel,
  modelSupportsCowork,
} from '@iblai/iblai-js/web-containers';
import { MemoryButton } from './memory-button';
import { CodingModeButton } from './coding-mode-button';
import { estimatePillWidth, useOverflowFit } from './use-overflow-fit';
import { MemoryMenu } from './memory-menu';
import { isTauriApp, isTauriMobile } from '@/types/tauri';
import type { OpencodeSkillSync } from '@/hooks/use-opencode-skill-sync';
import { useInExtensionPanel } from '@/hooks/use-in-extension-panel';

/** One tool pill in the composer row (inline) or the ••• overflow menu. */
interface ToolPill {
  name: string;
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  action: () => void;
  isEnabled: boolean;
  /** Set when this specific tool can't run here; also the tooltip text. */
  disabledReason?: string;
}

// 12GB floor, matching the SDK default (DEFAULT_COWORK_REQUIRED_SIZE_GB)
// and the Local Models tab's "supported" indicator. modelSupportsCowork
// gates size <= gb (strictly greater), so a model of exactly 12GB is also off.
const COWORK_MIN_MODEL_GB = 12;

interface InsideButtonsProps {
  /** The chat this input belongs to. Code keys its per-chat workspace on it. */
  sessionId?: string;
  activeOptions: string[];
  onOptionClick: (optionName: string) => Promise<void>;
  deepResearch: boolean;
  artifactsEnabled: boolean;
  studyMode: boolean;
  containerWidth: number;
  disabled?: boolean;
  onOpenPromptGallery?: () => void;
  embedMode?: boolean;
  promptsIsEnabled?: boolean;
  memoryEnabled?: boolean;
  /**
   * When chat private mode is active (effective mode === 'disabled'), the
   * Memory button is hidden — memory is not stored for a private session, so
   * offering it would be misleading. See chat-input-form.tsx for where this
   * is derived from `useChatPrivacy`.
   */
  isPrivate?: boolean;
  tenantKey?: string;
  username?: string;
  /**
   * The mentor's enabled Agent Skills, for the Skills dropdown — a
   * discoverable alternative to typing `/` in the composer. Empty/undefined
   * hides the button entirely (mentor has no skills).
   */
  skills?: EffectiveAgentSkill[];
  /**
   * Slugs currently invoked as `/slug` tokens in the composer text. Drives
   * the button's active state and the per-item check marks, so the dropdown
   * and the `/` picker can never disagree — both derive from the same text.
   */
  activeSkillSlugs?: Set<string>;
  /** Adds the skill's `/slug` token to the composer, or removes it if armed. */
  onToggleSkill?: (skill: EffectiveAgentSkill) => void;
  /** Removes every armed skill token — the active pill's ✕ affordance. */
  onClearSkills?: () => void;
  /** More skill pages exist server-side (skills load 20 at a time). */
  hasMoreSkills?: boolean;
  /** A later skills page is in flight — renders a spinner row. */
  isFetchingMoreSkills?: boolean;
  /** Called when the menu is scrolled near its bottom. */
  onLoadMoreSkills?: () => void;
  /**
   * Code-mode skill sync (mentor + vibe skills onto the local agent's disk).
   * Drives the Code pill's spinner while syncing and its popover's error note.
   */
  skillSync?: OpencodeSkillSync;
}

export const InsideButtons = ({
  sessionId,
  activeOptions,
  onOptionClick,
  deepResearch,
  studyMode,
  artifactsEnabled,
  containerWidth,
  disabled = false,
  onOpenPromptGallery,
  embedMode = false,
  promptsIsEnabled = false,
  memoryEnabled = false,
  isPrivate = false,
  tenantKey,
  username,
  skills,
  activeSkillSlugs,
  onToggleSkill,
  onClearSkills,
  hasMoreSkills = false,
  isFetchingMoreSkills = false,
  onLoadMoreSkills,
  skillSync,
}: InsideButtonsProps) => {
  const t = useTranslations('chatInputFormInsideButtons');

  // The host reports a machine-readable code; never render it raw.
  const unsupportedCoworkReason = (reason?: string) => {
    switch (reason) {
      case 'kde_unproven':
        return t('coworkUnsupportedKde');
      case 'gnome_helper_missing':
        return t('coworkUnsupportedGnomeHelper');
      case 'unsupported_os':
        return t('coworkUnsupportedOs');
      default:
        return t('coworkUnsupportedSession');
    }
  };

  // Cowork drives THIS machine's screen — meaningful only on desktop. Tauri
  // mobile injects the same globals, so without this check the pill shows on
  // phones, where there is no computer to drive.
  const [tauriMobile, setTauriMobile] = useState(false);
  useEffect(() => {
    let cancelled = false;
    void isTauriMobile().then((mobile) => {
      if (!cancelled && mobile) setTauriMobile(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // In the Chrome extension's side panel the SAME pill is the browser driver:
  // there is no machine to drive, but there is a tab, and the extension's service
  // worker does the driving. The Cua Driver is never touched on that path.
  const inExtensionPanel = useInExtensionPanel();

  // Cowork = the Tauri Cua Driver assistant (useCuaDriver install/stop +
  // localStorage pref), no backend round-trip. Reads the pref on mount; cross-tab sync not
  // polled. Local state is `coworkOn` so it doesn't shadow the imported
  // setCoworkEnabled.
  const cuaDriver = useCuaDriver();
  const [coworkOn, setCoworkOn] = useState(isCoworkEnabled);
  // Switching Cowork ON explains itself first: it is about to read the contents
  // of the user's windows and send them off-device. Open = awaiting that consent.
  const [coworkConsentOpen, setCoworkConsentOpen] = useState(false);
  // The panel behind the pill in the extension, holding the on/off switch and
  // Approvals — the same shape as Code's popover, because it is the same choice.
  const [coworkPanelOpen, setCoworkPanelOpen] = useState(false);
  const [approvals, setApprovals] = useState<CoworkApprovals>('auto');
  // After mount, never during render: the pref is read from localStorage, and a
  // render-time read would mismatch the prerendered HTML during hydration.
  useEffect(() => setApprovals(readCoworkApprovals()), []);

  const chooseApprovals = (mode: CoworkApprovals) => {
    setApprovals(mode);
    writeCoworkApprovals(mode);
  };

  const toggleCowork = () => {
    if (coworkOn) {
      setCoworkOn(false);
      setCoworkEnabled(false);
      // Nothing to stop in the extension: the run ends with the port.
      if (!inExtensionPanel) cuaDriver.stop();
      return;
    }
    // In the panel the only backend is the remote AI, and there is no driver to
    // fetch, permission to request or screen to read — just the tab the user is
    // already looking at. No dialog on this surface: Chrome asked at install
    // time, and the note in the panel says what it does.
    if (inExtensionPanel) {
      if (!hasRemoteAiConfig()) {
        toast.warning(t('coworkNeedsSession'));
        return;
      }
      setCoworkOn(true);
      setCoworkEnabled(true);
      return;
    }
    // Guard before anything user-visible. Cowork runs on EITHER a large local
    // model or the remote AI (DM OpenAI-compatible endpoint) — allow enabling
    // when either backend is ready, so a local model is not required. Running
    // this first means a turn that is about to be refused never raises a consent
    // dialog or an OS permission prompt.
    const localReady =
      isLocalLLMEnabled() &&
      modelSupportsCowork(getLocalLLMModel(), COWORK_MIN_MODEL_GB);
    if (!localReady && !hasRemoteAiConfig()) {
      toast.warning(
        isLocalLLMEnabled()
          ? t('coworkModelTooSmall')
          : t('coworkNeedsLocalModel'),
      );
      return;
    }
    setCoworkConsentOpen(true);
  };

  /**
   * The user accepted the explanation: ask for the OS grants, and only switch
   * Cowork on if it actually has them. Desktop only — the panel enables
   * straight from its switch and never raises the dialog.
   */
  const acceptCoworkConsent = async () => {
    setCoworkConsentOpen(false);
    const { accessibility, screenRecording } =
      await cuaDriver.requestDriverPermissions();

    // `=== false` — checked and denied — never falsy. `null` means the host has
    // no such concept (Linux, Windows), where Cowork works and these grants do
    // not exist; treating that as denied would make it impossible to switch on
    // precisely where upstream has proven the driver.
    if (accessibility === false) {
      toast.warning(t('coworkNeedsAccessibility'));
      return;
    }
    if (screenRecording === false) {
      toast.warning(t('coworkNeedsScreenRecording'));
      return;
    }

    setCoworkOn(true);
    setCoworkEnabled(true);
    cuaDriver.install();
  };

  // Code (opencode over ACP) is desktop-only. Detected AFTER mount, never during
  // render: Tauri injects its globals into the remote origin some time after load, so a
  // render-time read can latch false forever (and would mismatch prerendered HTML
  // during hydration). Keeping the gate here also means <CodingModeButton> — which
  // needs Redux + the mentor route — never mounts in a plain browser.
  const [inTauri, setInTauri] = useState(false);
  useEffect(() => {
    if (isTauriApp()) return setInTauri(true);
    let tries = 0;
    const t = setInterval(() => {
      if (isTauriApp()) {
        setInTauri(true);
        clearInterval(t);
      } else if (++tries > 10) {
        clearInterval(t);
      }
    }, 500);
    return () => clearInterval(t);
  }, []);

  // Cowork is the FIRST entry of the responsive list (right after the fixed
  // Code pill), so it is the last tool to collapse into the ••• overflow.
  const coworkButton: ToolPill = {
    name: 'Cowork',
    label: t('cowork'),
    icon: <Monitor className="h-4 w-4" />,
    isActive: coworkOn,
    action: toggleCowork,
    // Cowork used to be macOS-only because GhostOS was. The Cua Driver runs on
    // Windows, macOS and Linux — but not on every Linux session, so an
    // unsupported one renders the pill DISABLED with the reason rather than
    // hiding it. The chatbox is Cowork's only surface: hide it and a KDE user is
    // left with no way to find out why the feature they read about is missing.
    // In the panel the pill is always usable: the driver support checks below
    // describe a desktop that is not involved.
    isEnabled: inExtensionPanel || cuaDriver.isAvailable,
    disabledReason: inExtensionPanel
      ? undefined
      : cuaDriver.isSupported
        ? undefined
        : unsupportedCoworkReason(cuaDriver.unsupportedReason),
  };
  // Deliberately NOT `coworkButton.isEnabled`: that is now true on any desktop so
  // the pill can render disabled-with-a-reason. Fetching a driver unattended
  // must still require a session the driver can actually drive.
  const coworkAvailable = cuaDriver.isAvailable && cuaDriver.isSupported;

  // On the desktop Cowork is deliberately opt-in: it reads the contents of the
  // user's windows and sends them off-device, and switching it on raises OS
  // permission prompts. Nothing enables it there but `toggleCowork`, behind the
  // consent dialog. (Code mode still defaults itself on; it asks for no OS
  // permissions, so it is left as it was.)
  //
  // The extension panel is the exception: driving the tab is what the panel is
  // for, so Cowork starts on. The PREF is written, not just `coworkOn` — the SDK
  // routes on `isCoworkEnabled()` (`shouldUseRemoteAiChat`, the Cowork tool list)
  // and so does the submit in `components/chat/index.tsx`, so a UI-only default
  // would show an active pill while the turn took the ordinary WebSocket path.
  // Only an UNSET pref defaults on: `setCoworkEnabled` writes "true"/"false", so
  // a user who switched it off is remembered. The panel's iframe has its own
  // partitioned storage, so this never reaches the user's ordinary tabs.
  useEffect(() => {
    if (!inExtensionPanel || coworkPrefSet()) return;
    setCoworkEnabled(true);
    setCoworkOn(true);
  }, [inExtensionPanel]);

  // The PREFERENCE persists across runs; the install does not. A user whose first
  // install failed comes back to a toggle that reads ON with no driver behind it,
  // and nothing would fetch one until they switched it off and on again.
  // Reconcile that here: Cowork on + session supported + host says not installed
  // ⇒ install. Deliberately install-only — this runs unattended at startup, so it
  // must never prompt for permissions.
  //
  // `status.installed === false` specifically, not falsy: `status` is null until
  // the first check lands, and firing on "unknown" would install on every mount.
  const ensuredDriverInstall = useRef(false);
  useEffect(() => {
    if (ensuredDriverInstall.current) return;
    if (inExtensionPanel) return;
    if (!coworkAvailable || !coworkOn) return;
    if (cuaDriver.status?.installed !== false) return;
    ensuredDriverInstall.current = true;
    cuaDriver.install();
  }, [coworkAvailable, coworkOn, cuaDriver, inExtensionPanel]);

  const allInsideButtons: ToolPill[] = [
    {
      name: 'Canvas',
      label: t('canvas'),
      icon: <CanvasIcon className="h-4 w-4" />,
      isActive: artifactsEnabled,
      action: () => onOptionClick(TOOLS.CANVAS),
      isEnabled: true,
    },
    {
      name: 'Prompts',
      label: t('prompts'),
      icon: <Terminal className="h-4 w-4" />,
      isActive: false,
      action: () => onOpenPromptGallery?.(),
      isEnabled: !embedMode && promptsIsEnabled,
    },
    {
      name: 'Study Mode',
      label: t('studyMode'),
      icon: <BookOpen className="h-4 w-4" />,
      isActive: activeOptions.includes(TOOLS.STUDY_MODE),
      action: () => onOptionClick(TOOLS.STUDY_MODE),
      isEnabled: studyMode,
    },
    {
      name: 'Deep Research',
      label: t('deepResearch'),
      icon: <DeepSearchIcon className="h-4 w-4" />,
      isActive: activeOptions.includes(TOOLS.DEEP_RESEARCH),
      action: () => onOptionClick(TOOLS.DEEP_RESEARCH),
      isEnabled: deepResearch,
    },
    {
      name: 'Memory',
      label: t('memory'),
      icon: <Archive className="h-4 w-4" />,
      isActive: activeOptions.includes(TOOLS.MEMORY),
      // Memory uses <MemoryButton> in visible mode and a popover handler in
      // the hidden dropdown, so this `action` lambda is unreachable.
      action: /* istanbul ignore next */ () => onOptionClick(TOOLS.MEMORY),
      // Hidden in private mode — memory is not stored for a private session.
      isEnabled: memoryEnabled && !embedMode && !!username && !isPrivate,
    },
  ].filter((item) => item.isEnabled);

  const overflowItems: ToolPill[] = [
    ...(coworkButton.isEnabled && !tauriMobile ? [coworkButton] : []),
    ...allInsideButtons,
  ];

  // Priority overflow. Pills keep their order and, as the row narrows,
  // collapse ONE BY ONE from the end into the ••• menu, driven by the row's
  // measured width and each pill's measured width — never by a viewport
  // breakpoint. Active pills (`icon + label + ✕`) are wider and are fitted
  // as such, so the row can never push the send control out of line (#1533).
  // Code and Skills stay inline (each owns its own popover / menu) and only
  // take their space out of the fit. Until the row has been measured (first
  // paint, or while it is not displayed) fall back to the old breakpoint
  // rule: nothing inline below 800px, everything above.
  const fit = useOverflowFit(
    overflowItems.map((button) => ({
      key: button.name,
      estimate: estimatePillWidth(button.label, button.isActive),
    })),
    ['Code', 'Skills'],
  );
  const legacyVisibleCount =
    (overflowItems.length === 1 && containerWidth > 120) ||
    containerWidth >= 800
      ? overflowItems.length
      : 0;
  const visibleCount = fit.visibleCount ?? legacyVisibleCount;
  const visibleInsideButtons = overflowItems.slice(0, visibleCount);
  const hiddenInsideButtons = overflowItems.slice(visibleCount);

  const [hiddenMemoryPopoverOpen, setHiddenMemoryPopoverOpen] = useState(false);

  // Inline pill markup. The wrapper is measured so the overflow fit knows
  // the pill's real width (label, active ✕ and all).
  const renderToolButton = (button: ToolPill) => (
    <div
      key={button.name}
      ref={fit.itemRef(button.name)}
      className="relative"
      data-overflow-key={button.name}
    >
      <Button
        variant="ghost"
        size="sm"
        type="button"
        disabled={disabled || !!button.disabledReason}
        title={button.disabledReason}
        // The pill's on/off state is otherwise styling-only. Exposed as
        // aria-pressed so assistive tech and e2e (ChatPage.isCanvasToolActive)
        // can read it — the inactive `hover:bg-[#F5F8FF]` class contains the
        // active `bg-[#F5F8FF]` token as a substring, so class sniffing lies.
        aria-pressed={button.isActive}
        className={`flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
          button.isActive
            ? 'border border-[#D0E0FF] bg-[#F5F8FF] text-[#38A1E5]'
            : 'text-gray-600 hover:border hover:border-[#D0E0FF] hover:bg-[#F5F8FF]'
        }`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          button.action();
        }}
      >
        <span className={button.isActive ? 'text-[#38A1E5]' : 'text-gray-600'}>
          {button.icon}
        </span>
        <span>{button.label}</span>
        {button.isActive && (
          <X
            className="ml-1 h-3 w-3 cursor-pointer"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
            }}
          />
        )}
      </Button>
    </div>
  );

  // Skills dropdown — a discoverable alternative to typing `/` in the
  // composer, rendered right AFTER Canvas (Canvas stays first). Its active
  // state and check marks derive from the SAME composer text the `/` picker
  // writes, so the two ways of invoking a skill are always in sync. Hidden
  // when the mentor has no skills.
  const skillsMenu =
    skills && skills.length > 0 && onToggleSkill ? (
      <div
        ref={fit.itemRef('Skills')}
        className="flex"
        data-overflow-key="Skills"
      >
        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={disabled}>
            <Button
              variant="ghost"
              size="sm"
              type="button"
              disabled={disabled}
              data-testid="skills-menu-trigger"
              className={`flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                activeSkillSlugs && activeSkillSlugs.size > 0
                  ? 'border border-[#D0E0FF] bg-[#F5F8FF] text-[#38A1E5]'
                  : 'text-gray-600 hover:border hover:border-[#D0E0FF] hover:bg-[#F5F8FF]'
              }`}
            >
              <Sparkles className="h-4 w-4" />
              {/* Show the armed skill's name so the button mirrors the token
                  in the composer; falls back to the generic label. On phone
                  widths an INACTIVE pill shrinks to its icon; once a skill
                  is armed the name always shows, so the user can see what
                  is selected. */}
              <span
                className={
                  activeSkillSlugs && activeSkillSlugs.size > 0
                    ? undefined
                    : 'max-[520px]:hidden'
                }
              >
                {(activeSkillSlugs &&
                  activeSkillSlugs.size > 0 &&
                  skills.find((skill) => activeSkillSlugs.has(skill.slug))
                    ?.name) ||
                  t('skills')}
              </span>
              {/* Same ✕ affordance as every other active tool pill — disarms
                the skill(s) without opening the menu. Radix opens the menu
                on pointerdown, so that's where propagation must stop. The
                handlers live on a SPAN, not the svg: the Button's base
                styles set `[&_svg]:pointer-events-none`, which makes the
                icon itself event-dead in real browsers. */}
              {activeSkillSlugs &&
                activeSkillSlugs.size > 0 &&
                onClearSkills && (
                  <span
                    data-testid="skills-menu-clear"
                    role="button"
                    aria-label={t('skills')}
                    className="ml-1 inline-flex cursor-pointer items-center"
                    onPointerDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                    }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      onClearSkills();
                    }}
                  >
                    <X className="h-3 w-3" />
                  </span>
                )}
            </Button>
          </DropdownMenuTrigger>
          {/* Sizes to its content: min width keeps short name-only lists from
            looking cramped, the max caps at 18rem OR the viewport (minus a
            1rem gutter) on small devices, and long skill lists scroll
            instead of overflowing short screens. */}
          <DropdownMenuContent
            align="start"
            collisionPadding={8}
            data-testid="skills-menu-content"
            className="max-h-[min(60vh,20rem)] max-w-[min(18rem,calc(100vw-1rem))] min-w-40 overflow-y-auto"
            // Lazy loading: skills come 20 per page — scrolling near the
            // bottom pulls the next page, mirroring the `/` picker.
            onScroll={(e) => {
              if (!hasMoreSkills || isFetchingMoreSkills || !onLoadMoreSkills) {
                return;
              }
              const el = e.currentTarget;
              if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
                onLoadMoreSkills();
              }
            }}
          >
            {skills.map((skill) => {
              const isArmed = activeSkillSlugs?.has(skill.slug) ?? false;
              return (
                <DropdownMenuItem
                  key={skill.unique_id}
                  data-testid={`skills-menu-item-${skill.slug}`}
                  onClick={() => onToggleSkill(skill)}
                  className="flex items-start gap-2"
                >
                  {/* Name stacked over the slug: the full name wraps instead of
                      truncating to "canvas-course-b…", and the slug below it
                      gets the row's whole width too. */}
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                    <span
                      data-testid="skills-menu-item-name"
                      className="text-sm break-words text-gray-800"
                    >
                      {skill.name}
                    </span>
                    {/* Slash-invocation form, mirroring the `/` picker's rows */}
                    <span
                      data-testid="skills-menu-item-slug"
                      className="text-xs break-all text-gray-400"
                    >
                      /{skill.slug}
                    </span>
                  </span>
                  {/* Armed marker sits on the RIGHT (same pattern as the •••
                    overflow menu above) so rows never carry a left indent. */}
                  {isArmed && (
                    <Check
                      aria-hidden="true"
                      className="mt-0.5 h-4 w-4 shrink-0 text-[#38A1E5]"
                    />
                  )}
                </DropdownMenuItem>
              );
            })}
            {isFetchingMoreSkills && (
              <div
                data-testid="skills-menu-loading-more"
                className="flex items-center justify-center px-2 py-1.5"
              >
                <Loader2 className="h-4 w-4 animate-spin text-gray-400" />
              </div>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ) : null;

  const canvasIsVisible = visibleInsideButtons.some(
    (button) => button.name === 'Canvas',
  );

  return (
    // `min-w-0 flex-1`: the row takes exactly the space left beside the
    // composer's other controls, and that width is what the overflow fit
    // measures.
    <div
      ref={fit.rootRef}
      className="relative flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden"
      data-testid="inside-buttons-row"
    >
      {/* Code — the desktop assistant, always first and always inline. */}
      {inTauri && (
        <div
          ref={fit.itemRef('Code')}
          className="flex"
          data-overflow-key="Code"
        >
          <CodingModeButton sessionId={sessionId} skillSync={skillSync} />
        </div>
      )}
      {/* Responsive pills (Cowork first, then the tools) — the Skills
          dropdown slots in right after Canvas so Canvas stays the first
          tool pill. */}
      {visibleInsideButtons.map((button) => {
        // In the extension the pill opens a panel instead of toggling: the
        // browser driver has an Approvals choice to make, and the desktop Cua
        // Driver has no confirmation gate for it to control.
        if (button.name === 'Cowork' && inExtensionPanel) {
          return (
            <div
              key={button.name}
              ref={fit.itemRef(button.name)}
              className="relative"
              data-overflow-key={button.name}
            >
              <Popover open={coworkPanelOpen} onOpenChange={setCoworkPanelOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    type="button"
                    data-testid="cowork-pill"
                    disabled={disabled}
                    aria-pressed={button.isActive}
                    className={`flex h-8 items-center gap-1.5 rounded-lg px-2 text-sm transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50 ${
                      button.isActive
                        ? 'border border-[#D0E0FF] bg-[#F5F8FF] text-[#38A1E5]'
                        : 'text-gray-600 hover:border hover:border-[#D0E0FF] hover:bg-[#F5F8FF]'
                    }`}
                  >
                    <span
                      className={
                        button.isActive ? 'text-[#38A1E5]' : 'text-gray-600'
                      }
                    >
                      {button.icon}
                    </span>
                    <span>{button.label}</span>
                    <ChevronDown className="h-3 w-3 opacity-60" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  data-testid="cowork-panel"
                  className="w-72 rounded-lg border border-gray-200 bg-white p-3 shadow-xl"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span
                      data-testid="cowork-panel-title"
                      className="text-sm text-gray-700"
                    >
                      {button.label}
                    </span>
                    <Switch
                      checked={button.isActive}
                      aria-label={button.label}
                      onCheckedChange={() => button.action()}
                    />
                  </div>
                  {/* What the dialog used to say, where it does not interrupt:
                      the panel enables Cowork on open, so the disclosure has to
                      live somewhere it can be read afterwards. Same quiet grey
                      as the Approvals hint below — it states a fact, it is not
                      asking for anything. */}
                  <p
                    data-testid="cowork-tab-note"
                    className="mt-1 text-[11px] text-gray-400"
                  >
                    {t('coworkTabNote')}
                  </p>
                  {/* Approvals. A quiet segmented pair rather than a second
                      Switch, matching the Code panel's row exactly: the two
                      modes have names worth showing, and this must not compete
                      with the on/off control above it. */}
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-gray-600">
                      {t('coworkApprovalsLabel')}
                    </span>
                    <div
                      role="radiogroup"
                      aria-label={t('coworkApprovalsLabel')}
                      className="flex items-center gap-0.5 rounded-md border border-gray-200 p-0.5"
                    >
                      {(['manual', 'auto'] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          role="radio"
                          aria-checked={approvals === mode}
                          onClick={() => chooseApprovals(mode)}
                          className={`h-6 rounded px-2 text-[11px] transition-colors ${
                            approvals === mode
                              ? 'bg-gray-100 text-gray-900'
                              : 'text-gray-500 hover:text-gray-700'
                          }`}
                        >
                          {mode === 'manual'
                            ? t('coworkApprovalsManual')
                            : t('coworkApprovalsAuto')}
                        </button>
                      ))}
                    </div>
                  </div>
                  {approvals === 'auto' && (
                    <p
                      data-testid="cowork-auto-mode-hint"
                      className="mt-1 text-[11px] text-gray-400"
                    >
                      {t('coworkApprovalsAutoHint')}
                    </p>
                  )}
                </PopoverContent>
              </Popover>
            </div>
          );
        }

        if (button.name === 'Memory') {
          return (
            <div
              key={button.name}
              ref={fit.itemRef(button.name)}
              className="flex"
              data-overflow-key={button.name}
            >
              <MemoryButton tenantKey={tenantKey} username={username} />
            </div>
          );
        }

        if (button.name === 'Canvas') {
          return (
            <Fragment key={button.name}>
              {renderToolButton(button)}
              {skillsMenu}
            </Fragment>
          );
        }

        return renderToolButton(button);
      })}
      {/* When Canvas is collapsed into the ••• overflow (mobile/tablet) the
          Skills dropdown still renders inline here. */}
      {!canvasIsVisible && skillsMenu}

      {/* Hidden inside buttons dropdown if needed */}
      {hiddenInsideButtons.length > 0 && (
        <Popover
          open={hiddenMemoryPopoverOpen}
          onOpenChange={setHiddenMemoryPopoverOpen}
        >
          <PopoverAnchor>
            <DropdownMenu>
              <DropdownMenuTrigger asChild disabled={disabled}>
                <Button
                  variant="ghost"
                  size="icon"
                  type="button"
                  disabled={disabled}
                  className="h-8 w-8 rounded-lg text-gray-600 transition-all duration-200 hover:border hover:border-[#D0E0FF] hover:bg-[#F5F8FF] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="text-xs">•••</span>
                  <span className="sr-only">{t('moreOptions')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-48">
                {/* Hidden buttons are always inactive based on current logic, so isActive branches are defensive */}
                {hiddenInsideButtons.map((button) => {
                  const isMemory = button.name === 'Memory';
                  return (
                    <DropdownMenuItem
                      key={button.name}
                      disabled={!!button.disabledReason}
                      title={button.disabledReason}
                      onClick={
                        isMemory
                          ? (e) => {
                              e.preventDefault();
                              setHiddenMemoryPopoverOpen(true);
                            }
                          : button.action
                      }
                      className={
                        /* istanbul ignore next */ button.isActive
                          ? 'bg-[#F5F8FF] text-[#38A1E5]'
                          : ''
                      }
                    >
                      <div className="flex w-full items-center gap-2">
                        <span
                          className={
                            /* istanbul ignore next */ button.isActive
                              ? 'text-[#38A1E5]'
                              : 'text-gray-600'
                          }
                        >
                          {button.icon}
                        </span>
                        <span className="flex-1">{button.label}</span>
                        {
                          /* istanbul ignore next */ button.isActive && (
                            <Check className="h-4 w-4 text-[#38A1E5]" />
                          )
                        }
                      </div>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </PopoverAnchor>
          <PopoverContent
            align="start"
            className="w-96 rounded-lg border border-gray-200 bg-white p-0 shadow-xl"
            onOpenAutoFocus={(e) => e.preventDefault()}
            // Radix wires this onto a global focus-outside listener that
            // jsdom cannot reliably trigger from a unit test.
            onFocusOutside={
              /* istanbul ignore next */ (e) => e.preventDefault()
            }
          >
            <MemoryMenu
              onClose={() => setHiddenMemoryPopoverOpen(false)}
              tenantKey={tenantKey}
              username={username}
            />
          </PopoverContent>
        </Popover>
      )}

      {/* Switching Cowork on grants it the run of the machine, so it says what
          that means before any OS prompt appears. Dismissing leaves Cowork off
          and asks the system for nothing. Desktop only: the extension panel
          drives one tab, which Chrome already asked about at install time, and
          says so in the panel instead of interrupting. */}
      <AlertDialog open={coworkConsentOpen} onOpenChange={setCoworkConsentOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('coworkConsentTitle')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('coworkConsentBody')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('coworkConsentCancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={acceptCoworkConsent}>
              {t('coworkConsentConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
