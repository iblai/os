'use client';

import type React from 'react';

import { useState, useRef, useMemo, useEffect, ChangeEvent } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { format } from 'date-fns';
import { useMediaQuery } from 'react-responsive';
import { FileText, Loader2 } from 'lucide-react';
import { useAppSelector, useAppDispatch } from '@/lib/hooks';
import { removeFile } from '@iblai/iblai-js/web-utils';
import { RootState } from '@/store';
import { Message } from '@iblai/iblai-js/web-utils';
import { MENTOR_CHAT_DOCUMENTS_EXTENSIONS } from '@iblai/iblai-js/web-utils';
import { useAccessingPublicRoute } from '@/hooks/use-anonymous-mentor';
import { useChatFileUpload } from '@/hooks/use-chat-file-upload';
import { cn, isLoggedIn } from '@/lib/utils';
import { extractFilesFromClipboard } from '@/lib/clipboard';
import useVoiceChat from '@/hooks/use-voice-chat';
import { VoiceChatButton } from './chat-input-form/voice-chat-button';
import { RetrievedDocumentsButton } from './retrieved-documents-button';
import dynamic from 'next/dynamic';
import { useEmbedMode } from '@/hooks/use-embed-mode';
import { StopStreamingButton } from './chat/stop-streaming-button';
import { SubmitMessageButton } from './chat/submit-message-button';
import { useShowFreeTrialDialog } from '@/hooks/user-user-actions';
import { CSS_CLASS_NAMES } from '@/lib/constants';
import { ScreenSharingButton } from './chat-input-form/screen-sharing-button';
import AutoResizeTextarea from './auto-resize-text-area';
import { OutsideButtons } from './chat-input-form/outside-buttons';
import { UploadMenu } from './chat-input-form/upload-menu';
import { CameraCaptureDialog } from './chat-input-form/camera-capture-dialog';
import { useIsMobileOS } from '@/hooks/use-is-mobile-os';
import {
  chatInputSliceActions,
  chatInputSliceSelectors,
} from '@/features/chat-input/api-slice';
import { useResponsive } from '@/hooks/use-responsive';
import { InsideButtons } from './chat-input-form/inside-buttons';
import { VoiceCallButton } from './chat-input-form/voice-call-button';
import { useMentorSettings } from '@/hooks/use-mentors/use-mentor-settings';
import { MentorVisibilityEnum } from '@iblai/iblai-api';
import {
  selectShowingSharedChat,
  useTenantMetadata,
} from '@iblai/iblai-js/web-utils';
import { useVisitingTenant } from '@/hooks/use-user';
import { FileAttachmentsList } from './chat-input-form/file-attachments-list';
import { toast } from 'sonner';
import { useModelFileUploadCapabilities } from '@/hooks/use-model-file-upload-capabilities';
import { selectRbacPermissions } from '@/features/rbac/rbac-slice';
import { checkRbacPermission } from '@/hoc/withPermissions';
import { config } from '@/lib/config';
import {
  useChatPrivacy,
  SlashSkillPicker,
  useSlashSkillPicker,
} from '@iblai/iblai-js/web-containers';
import {
  useGetMentorSkillAssignmentsQuery,
  resolveEffectiveAgentSkills,
  type EffectiveAgentSkill,
  type MentorSkillAssignment,
} from '@iblai/iblai-js/data-layer';
import { TenantKeyMentorIdParams } from '@/lib/types';
import { useOpencodeSkillSync } from '@/hooks/use-opencode-skill-sync';

// Fallback used when the configured paste-to-attachment threshold is missing
// or non-numeric, so a misconfigured env value can't make a 0-char threshold
// convert every paste into an attachment. Mirrors the config default.
const DEFAULT_MAX_CHARACTERS_TO_COPY = 2000;

// Skills load lazily, one page per scroll-to-bottom of the picker/dropdown.
const SKILLS_PAGE_SIZE = 20;

// The SDK types query data as `list | paginated envelope`; runtime is
// normalized to a list, but unwrap defensively either way.
const asList = <T,>(data: T[] | { results?: T[] } | undefined): T[] =>
  Array.isArray(data) ? data : (data?.results ?? []);

const PromptGalleryModal = dynamic(
  () =>
    import('@/components/modals/prompt-gallery-modal').then(
      (mod) => mod.PromptGalleryModal,
    ),
  {
    ssr: false,
  },
);

interface ChatInputFormProps {
  onSubmit: (content: string) => void;
  onScreenSharingClick: () => void;
  isScreenSharingModalOpen: boolean;
  onPhoneCallClick: () => void;
  sessionId: string;
  stopGenerating: () => void;
  tenantKey: string;
  username: string;
  enableWebBrowsing: boolean;
  setMessage: (messages: Message) => void;
  isStreaming: boolean;
  enableSafetyDisclaimer: boolean;
  isPreviewMode?: boolean;
  updateSessionTools: (tool: string) => Promise<void>;
  setSessionTools: (tools: string[]) => Promise<void>;
  activeTools: string[];
  screenSharing: boolean;
  deepResearch: boolean;
  studyMode: boolean;
  imageGeneration: boolean;
  codeInterpreter: boolean;
  promptsIsEnabled: boolean;
  googleSlidesIsEnabled: boolean;
  googleDocumentIsEnabled: boolean;
  artifactsEnabled: boolean;
  /** When true, shows only textarea and submit button (hides voice call, screen share, prompts, etc.) */
  compactMode?: boolean;
  chatAreaMaxWidth?: number;
  /** When true, shows a loading state in the submit button indicating the connection is being established */
  isConnecting?: boolean;
}

export function ChatInputForm({
  onSubmit,
  onScreenSharingClick,
  isScreenSharingModalOpen,
  onPhoneCallClick,
  sessionId,
  stopGenerating,
  tenantKey,
  username,
  isPreviewMode,
  enableWebBrowsing,
  isStreaming,
  updateSessionTools,
  setSessionTools,
  activeTools,
  screenSharing,
  deepResearch,
  studyMode,
  imageGeneration,
  codeInterpreter,
  promptsIsEnabled,
  googleSlidesIsEnabled,
  googleDocumentIsEnabled,
  artifactsEnabled,
  compactMode = false,
  chatAreaMaxWidth,
  isConnecting = false,
}: ChatInputFormProps) {
  const dispatch = useAppDispatch();
  // `useParams()` returns null outside an app-router context (e.g. first render
  // or when rendered in isolation), so read the id defensively.
  const mentorId = useParams<TenantKeyMentorIdParams>()?.mentorId;
  const mentorSettings = useMentorSettings();
  const showingSharedChat = useAppSelector(selectShowingSharedChat);

  // Chat private mode signal — same source the nav-bar ChatPrivacyToggle uses.
  // When the effective mode is 'disabled' the active session is private, so the
  // Memory button is hidden (memory is not stored for a private session). Gate
  // on `isEffectiveReady` so we don't flash-hide before the query resolves.
  const {
    effective: chatPrivacyEffective,
    isEffectiveReady: chatPrivacyReady,
  } = useChatPrivacy({ org: tenantKey, userId: username, mentor: mentorId });
  const chatPrivacyActive =
    chatPrivacyReady && chatPrivacyEffective?.mode === 'disabled';
  const rbacPermissions = useAppSelector(selectRbacPermissions);
  const { metadata: tenantMetadata } = useTenantMetadata({ org: tenantKey });
  const persistentChatInputLabel =
    tenantMetadata?.persistent_chat_input_label === true;

  const hasShareableToken = !!useSearchParams().get('token');

  // Check if user has chat permission via RBAC
  const mentorDbId = mentorSettings?.data?.mentorDbId;
  const mentorRbacKey = mentorDbId ? `/mentors/${mentorDbId}/` : null;
  const hasMentorRbacData = mentorRbacKey
    ? mentorRbacKey in rbacPermissions
    : false;
  const hasChatPermission =
    (hasShareableToken && !!sessionId) ||
    (mentorDbId && hasMentorRbacData
      ? checkRbacPermission(rbacPermissions, `/mentors/${mentorDbId}/#chat`)
      : true); // Default to true if mentor ID not available or RBAC data not loaded
  const isChatDisabledByRbac = !hasChatPermission;
  const isSendDisabled = isChatDisabledByRbac || !sessionId;

  // Listing an agent's skills is a separate, stricter grant than chatting:
  // `GET .../agents/{uuid}/skills/` 403s for users without
  // `view_skill_assignments`, so the skills fetch stays off until the
  // mentor's permission check has explicitly granted it. No permission data
  // loaded means no fetch — chatting never needs this endpoint.
  const hasSkillAssignmentsPermission =
    mentorDbId && hasMentorRbacData
      ? checkRbacPermission(
          rbacPermissions,
          `/mentors/${mentorDbId}/#view_skill_assignments`,
        )
      : false;

  const {
    FreeTrialDialog,
    closeModal: closeFreeTrialModal,
    isModalOpen: isFreeTrialModalOpen,
    executeWithTrialCheck,
  } = useShowFreeTrialDialog();
  const embedMode = useEmbedMode();
  const inputValue = useAppSelector(
    chatInputSliceSelectors.selectTextareaInput,
  );
  const containerRef = useRef<HTMLFormElement>(null);
  const { containerWidth } = useResponsive(
    containerRef as React.RefObject<HTMLElement>,
  );

  const [textAreaRows] = useState(1);
  const [isPromptGalleryOpen, setIsPromptGalleryOpen] = useState(false);
  const [fileAddedNotification, setFileAddedNotification] = useState<
    string | null
  >(null);
  const [isCameraDialogOpen, setIsCameraDialogOpen] = useState(false);
  const fileUploadInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const isMobileOS = useIsMobileOS();
  const isTabletOrMobile = useMediaQuery({ maxWidth: 1023 });
  const isAccessingPublicRoute = useAccessingPublicRoute();
  const userIsVisiting = useVisitingTenant();
  const fileUploadCapabilities = useModelFileUploadCapabilities();

  const { uploadFiles, retryUpload } = useChatFileUpload({
    org: tenantKey,
    userId: username,
    errorHandler: (error) => toast.error(error),
    capabilities: {
      supportsFileUpload: fileUploadCapabilities.supportsFileUpload,
      allSupportedTypes: fileUploadCapabilities.allSupportedTypes,
      maxFileSizeMB: fileUploadCapabilities.maxFileSizeMB,
      maxFilesPerMessage: fileUploadCapabilities.maxFilesPerMessage,
    },
  });

  const visibleToLoggedInUsersOnly = !isAccessingPublicRoute || isLoggedIn();
  const isMentorViewableByAnyone =
    mentorSettings?.data?.mentorVisibility ===
    MentorVisibilityEnum.VIEWABLE_BY_ANYONE;

  const setInputValue = (input: string) => {
    dispatch(chatInputSliceActions.setTextareaInput(input));
    // Programmatic writes (prompt gallery, voice, submit-clear, skill splice)
    // carry no caret info — drop any tracked slash token; the next change
    // event re-derives it. `handleInputChange` overrides this right after.
    setSlashContext(null);
  };

  // `/` skill picker (Base Agent mentors). The skill list comes from ONE
  // endpoint: the mentor's skill assignments
  // (`GET .../agents/{uuid}/skills/`). The platform catalog
  // (`GET .../agent-skills/`) is deliberately NOT fetched — it lists every
  // skill on the platform, not this mentor's. Known trade-offs of
  // assignments-only until a mentor-scoped skills read exists backend-side:
  // no mentor-private skills (attached by ownership, absent from assignment
  // rows), no descriptions in the picker (assignment rows carry only
  // name/slug/enabled). Users without `view_skill_assignments` never hit the
  // endpoint at all (it would 403) — they simply get no picker. Errors
  // degrade to an inactive picker.
  const mentorUniqueId = mentorSettings?.data?.mentorUniqueId;
  const skillsQuerySkipped =
    !mentorUniqueId || !tenantKey || !username || !hasSkillAssignmentsPermission;

  // Code mode: keep this mentor's Agent Skills (plus the shared vibe skills)
  // materialised on disk for the local opencode agent. Idle outside Tauri or
  // while Code is off; drives the Code pill's spinner and error note.
  const skillSync = useOpencodeSkillSync({ org: tenantKey, mentorUniqueId });

  // Paged fetching, 20 at a time, matching the SDK picker's lazy-load
  // contract: pages accumulate as the user scrolls the picker/dropdown near
  // their bottoms. RTK caches each page by its arg, so revisits are free.
  const [skillsPage, setSkillsPage] = useState(0);
  const [loadedAssignments, setLoadedAssignments] = useState<
    MentorSkillAssignment[]
  >([]);
  const [hasMoreSkills, setHasMoreSkills] = useState(false);

  // Switching mentors restarts the pagination from the first page.
  useEffect(() => {
    setSkillsPage(0);
    setLoadedAssignments([]);
    setHasMoreSkills(false);
  }, [mentorUniqueId]);

  const { data: assignmentsPageData, isFetching: skillsPageFetching } =
    useGetMentorSkillAssignmentsQuery(
      {
        org: tenantKey,
        mentorUniqueId: mentorUniqueId ?? '',
        limit: SKILLS_PAGE_SIZE,
        offset: skillsPage * SKILLS_PAGE_SIZE,
      },
      { skip: skillsQuerySkipped },
    );

  useEffect(() => {
    if (!assignmentsPageData) return;
    const rows = asList(assignmentsPageData);
    // The paginated envelope's count is authoritative when present; a full
    // page is the fallback signal that another page may exist.
    const total = Array.isArray(assignmentsPageData)
      ? undefined
      : (assignmentsPageData as { count?: number }).count;
    setLoadedAssignments((previous) => {
      const next =
        skillsPage === 0
          ? rows
          : [
              ...previous.filter(
                (row) => !rows.some((incoming) => incoming.id === row.id),
              ),
              ...rows,
            ];
      // Referential stability: bail out when the merged content is
      // unchanged so an unstable `data` reference can't rerender-loop.
      const unchanged =
        next.length === previous.length &&
        next.every((row, index) => row.id === previous[index]?.id);
      return unchanged ? previous : next;
    });
    setHasMoreSkills(
      total !== undefined
        ? (skillsPage + 1) * SKILLS_PAGE_SIZE < total
        : rows.length === SKILLS_PAGE_SIZE,
    );
  }, [assignmentsPageData, skillsPage]);

  const loadMoreSkills = () => {
    if (hasMoreSkills && !skillsPageFetching) {
      setSkillsPage((page) => page + 1);
    }
  };

  const slashSkillsLoading = skillsPageFetching && skillsPage === 0;
  const isFetchingMoreSkills = skillsPageFetching && skillsPage > 0;

  const slashSkills = useMemo(() => {
    if (loadedAssignments.length && mentorUniqueId) {
      // Empty catalog: the resolver falls back to the assignment rows'
      // skill_name/skill_slug and the assignment's own enabled flag.
      return resolveEffectiveAgentSkills([], loadedAssignments, mentorUniqueId);
    }
    return [];
  }, [loadedAssignments, mentorUniqueId]);

  // Slugs eligible for in-place token highlighting and atomic deletion.
  const skillSlugSet = useMemo(
    () =>
      new Set(
        slashSkills
          .filter((skill) => skill.enabled !== false)
          .map((skill) => skill.slug),
      ),
    [slashSkills],
  );

  // The `/`-prefixed token the caret currently sits at, with its position in
  // the composer text — a slash token counts anywhere in the message as long
  // as it starts the text or follows whitespace ("explain this /web" ⇒
  // "/web"), so mid-sentence invocation works, while "and/or" or URLs never
  // trigger. Updated from change events (the only place the caret is known);
  // programmatic writes (prompt gallery, voice, submit-clear) reset it via
  // `setSlashContext(null)` in `setInputValue`.
  const [slashContext, setSlashContext] = useState<{
    token: string;
    start: number;
    end: number;
  } | null>(null);

  const updateSlashContext = (text: string, caret: number) => {
    const beforeCaret = text.slice(0, caret);
    const match = /(?:^|\s)(\/\S*)$/.exec(beforeCaret);
    // Only while the caret is at the token's end (rest of text must not
    // continue the token) — matches how pickers behave in Slack/Notion.
    const boundaryOk = caret === text.length || /^\s/.test(text.slice(caret));
    if (match && boundaryOk) {
      const token = match[1];
      setSlashContext({ token, start: caret - token.length, end: caret });
    } else {
      setSlashContext(null);
    }
  };

  const slashPicker = useSlashSkillPicker({
    // Feed the hook just the caret's slash token: its own state machine only
    // opens for a value that IS a single `/` token, so this extends the
    // trigger to any index without forking the SDK logic.
    inputValue: slashContext?.token ?? '',
    // The SDK picker finalizes a selection by writing `/${slug} ` into the
    // composer (both the Enter and the click path funnel through this
    // setter). Intercept exactly that write and splice the invocation into
    // the message AT the typed token's position — the token stays where the
    // user invoked it ("explain /web now" → "explain /web-research now") and
    // gets the highlight treatment from the backdrop layer below.
    setInputValue: (value) => {
      const invocation = /^\/(\S+) $/.exec(value);
      const skill = invocation
        ? slashSkills.find((s) => s.slug === invocation[1])
        : undefined;
      if (skill && slashContext) {
        const before = inputValue.slice(0, slashContext.start);
        const after = inputValue.slice(slashContext.end);
        // Keep exactly one separator after the token — `after` may already
        // start with the space the user typed around the invocation point.
        const separator = after.startsWith(' ') ? '' : ' ';
        setInputValue(`${before}/${skill.slug}${separator}${after}`);
        return;
      }
      setInputValue(value);
    },
    skills: slashSkills,
  });

  // Atomic token removal: one Backspace with the caret at (or just after)
  // a highlighted `/skill` token deletes the whole token; Delete does the
  // same forward from the token's start. Runs after the picker's own key
  // handling so list navigation keeps priority while the popover is open.
  const handleComposerKeyDown = (
    e: React.KeyboardEvent<HTMLTextAreaElement>,
  ): boolean => {
    if (slashPicker.handleKeyDown(e)) return true;
    if (skillSlugSet.size === 0) return false;

    // Plain ←/→ treat a skill token as ONE unit: the caret jumps across the
    // whole token instead of stepping through its characters, so the pill
    // behaves like an atomic chip. Modified arrows (shift-select, word/line
    // jumps) keep their native behavior.
    if (
      (e.key === 'ArrowLeft' || e.key === 'ArrowRight') &&
      !e.shiftKey &&
      !e.altKey &&
      !e.metaKey &&
      !e.ctrlKey
    ) {
      const el = e.currentTarget;
      const caret = el.selectionStart ?? 0;
      if (caret !== (el.selectionEnd ?? caret)) return false;
      const tokenRe = /(^|\s)(\/[\w-]+)(?=\s|$)/g;
      let match: RegExpExecArray | null;
      while ((match = tokenRe.exec(inputValue))) {
        if (!skillSlugSet.has(match[2].slice(1))) continue;
        const start = match.index + match[1].length;
        const end = start + match[2].length;
        if (e.key === 'ArrowLeft' && caret > start && caret <= end) {
          e.preventDefault();
          el.setSelectionRange(start, start);
          return true;
        }
        if (e.key === 'ArrowRight' && caret >= start && caret < end) {
          e.preventDefault();
          el.setSelectionRange(end, end);
          return true;
        }
      }
      return false;
    }

    if (e.key !== 'Backspace' && e.key !== 'Delete') {
      return false;
    }
    const el = e.currentTarget;
    const caret = el.selectionStart ?? inputValue.length;
    if (caret !== (el.selectionEnd ?? caret)) return false; // real selection → default behavior

    const spliceOut = (from: number, to: number) => {
      e.preventDefault();
      let next = inputValue.slice(0, from) + inputValue.slice(to);
      // Collapse the doubled space left when the token sat mid-sentence.
      if (next[from - 1] === ' ' && next[from] === ' ') {
        next = next.slice(0, from) + next.slice(from + 1);
      }
      setInputValue(next);
      // The controlled value swap moves the caret to the end; restore it to
      // the cut point on the next frame.
      requestAnimationFrame(() => el.setSelectionRange(from, from));
    };

    if (e.key === 'Backspace') {
      // Token (optionally + its trailing space) sitting directly before the
      // caret, at start-of-text or after whitespace.
      const match = /(?:^|\s)(\/[\w-]+)( ?)$/.exec(inputValue.slice(0, caret));
      if (match && skillSlugSet.has(match[1].slice(1))) {
        spliceOut(caret - match[1].length - match[2].length, caret);
        return true;
      }
    } else {
      // Delete: token starting exactly at the caret.
      const boundaryBefore = caret === 0 || /\s/.test(inputValue[caret - 1]);
      const match = /^(\/[\w-]+)( ?)/.exec(inputValue.slice(caret));
      if (match && boundaryBefore && skillSlugSet.has(match[1].slice(1))) {
        spliceOut(caret, caret + match[1].length + match[2].length);
        return true;
      }
    }
    return false;
  };

  // Backdrop segments: the composer text with every enabled `/skill` token
  // wrapped in a pill span styled like the ACTIVE inside-tool buttons (blue
  // text on #F5F8FF with a #D0E0FF ring). A plain <textarea> cannot color a
  // substring, so while a token is present the textarea's own text is made
  // transparent (caret kept) and this mirror layer — identical font,
  // padding and wrapping — renders ALL the text instead. The pill uses a
  // ring (box-shadow) rather than a border so it adds no layout width and
  // the mirror stays perfectly in sync with the textarea's metrics.
  const skillTokenSegments = useMemo(() => {
    if (!inputValue || skillSlugSet.size === 0) return null;
    const segments: React.ReactNode[] = [];
    const tokenRe = /(^|\s)(\/[\w-]+)/g;
    let last = 0;
    let match: RegExpExecArray | null;
    let found = false;
    while ((match = tokenRe.exec(inputValue))) {
      const tokenStart = match.index + match[1].length;
      const token = match[2];
      const tokenEnd = tokenStart + token.length;
      const boundaryAfter =
        tokenEnd === inputValue.length || /\s/.test(inputValue[tokenEnd]);
      if (boundaryAfter && skillSlugSet.has(token.slice(1))) {
        found = true;
        // Pull the boundary spaces (guaranteed by the token rule) INTO the
        // pill: they become its horizontal padding without moving a single
        // glyph, so the pill never crowds or overlaps the neighbouring
        // words and the mirror stays in perfect sync with the textarea.
        const pillStart =
          tokenStart > last && inputValue[tokenStart - 1] === ' '
            ? tokenStart - 1
            : tokenStart;
        const pillEnd = inputValue[tokenEnd] === ' ' ? tokenEnd + 1 : tokenEnd;
        // A side with no boundary space (token at the very start/end of the
        // text) gets real padding, cancelled by an equal negative margin so
        // no glyph moves. Safe exactly there: the bleed lands in the
        // textarea's own padding / trailing emptiness, never on characters —
        // and it matches the ~4px a space-side provides, so both sides of
        // the pill always read as equal padding.
        const hasLeadingSpace = pillStart < tokenStart;
        const hasTrailingSpace = pillEnd > tokenEnd;
        segments.push(inputValue.slice(last, pillStart));
        segments.push(
          <span
            key={tokenStart}
            data-testid="skill-token-highlight"
            className={cn(
              'rounded-md bg-[#F5F8FF] box-decoration-clone py-1 text-[#38A1E5] ring-1 ring-[#D0E0FF] ring-inset',
              !hasLeadingSpace && '-ml-1 pl-1',
              !hasTrailingSpace && '-mr-1 pr-1',
            )}
          >
            {inputValue.slice(pillStart, pillEnd)}
          </span>,
        );
        last = pillEnd;
      }
    }
    if (!found) return null;
    segments.push(inputValue.slice(last));
    return segments;
  }, [inputValue, skillSlugSet]);

  const highlightBackdropRef = useRef<HTMLDivElement>(null);

  // Skill slugs currently invoked as `/slug` tokens in the composer —
  // drives the Skills dropdown's active state/check marks so it always
  // agrees with what the `/` picker (or plain typing) put in the text.
  const activeSkillSlugs = useMemo(() => {
    const slugs = new Set<string>();
    const tokenRe = /(^|\s)(\/[\w-]+)(?=\s|$)/g;
    let match: RegExpExecArray | null;
    while ((match = tokenRe.exec(inputValue))) {
      const slug = match[2].slice(1);
      if (skillSlugSet.has(slug)) slugs.add(slug);
    }
    return slugs;
  }, [inputValue, skillSlugSet]);

  // Skills-dropdown toggle: arm the skill by prefixing its `/slug ` token
  // to the message, or remove every occurrence of the token if it is
  // already armed. Both paths write the composer text, which is the single
  // source of truth the picker, highlight and dropdown all derive from.
  // Also swallows ONE adjacent separator space (backtracks when the token
  // sits mid-sentence) so removal never leaves a dangling space behind.
  const stripSkillToken = (text: string, slug: string): string =>
    text.replace(
      new RegExp(
        String.raw`(?:^|\s)/${slug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} ?(?=\s|$)`,
        'g',
      ),
      '',
    );

  /**
   * Removes every armed `/slug` token from `text` while keeping a caret
   * position meaningful: offsets the caret left past each removal that
   * happened before it, so a subsequent insert lands where the user's
   * cursor actually was.
   */
  const stripArmedTokens = (
    text: string,
    caret: number,
  ): { text: string; caret: number } => {
    let result = text;
    let pos = caret;
    for (const armedSlug of activeSkillSlugs) {
      const tokenRe = new RegExp(
        String.raw`(?:^|\s)/${armedSlug.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} ?(?=\s|$)`,
        'g',
      );
      let match: RegExpExecArray | null;
      while ((match = tokenRe.exec(result))) {
        const start = match.index;
        const length = match[0].length;
        result = result.slice(0, start) + result.slice(start + length);
        if (pos > start) pos = Math.max(start, pos - length);
        tokenRe.lastIndex = start;
      }
    }
    const leadingWhitespace = /^\s+/.exec(result)?.[0].length ?? 0;
    if (leadingWhitespace) {
      result = result.slice(leadingWhitespace);
      pos = Math.max(0, pos - leadingWhitespace);
    }
    return { text: result, caret: Math.min(pos, result.length) };
  };

  const toggleSkillToken = (skill: EffectiveAgentSkill) => {
    if (activeSkillSlugs.has(skill.slug)) {
      setInputValue(
        stripSkillToken(inputValue, skill.slug).replace(/^\s+/, ''),
      );
      return;
    }
    // Arm at the CARET, not at the start of the message. The textarea keeps
    // its selection while focus moves to the dropdown, so read the caret off
    // the element; fall back to end-of-text when it isn't mounted. Single
    // selection: any currently-armed token is stripped first (caret
    // adjusted), then the token is inserted with a space on exactly the
    // sides that touch non-whitespace text — never doubled, never missing.
    const textareaEl = document.getElementById(
      'chat-input-textarea',
    ) as HTMLTextAreaElement | null;
    const rawCaret = textareaEl?.selectionStart ?? inputValue.length;
    const { text, caret } = stripArmedTokens(inputValue, rawCaret);
    const before = text.slice(0, caret);
    const after = text.slice(caret);
    const leftSeparator = before && !/\s$/.test(before) ? ' ' : '';
    const rightSeparator = !after || !/^\s/.test(after) ? ' ' : '';
    const token = `/${skill.slug}`;
    setInputValue(`${before}${leftSeparator}${token}${rightSeparator}${after}`);
    const nextCaret =
      caret + leftSeparator.length + token.length + rightSeparator.length;
    requestAnimationFrame(() => {
      textareaEl?.focus();
      textareaEl?.setSelectionRange(nextCaret, nextCaret);
    });
  };

  // The active Skills pill's ✕ — strips every armed `/slug` token (and its
  // highlight) from the composer in one go, mirroring the other tool pills'
  // deactivate affordance.
  const clearSkillTokens = () => {
    let next = inputValue;
    for (const armedSlug of activeSkillSlugs) {
      next = stripSkillToken(next, armedSlug);
    }
    setInputValue(next.replace(/^\s+/, ''));
  };

  const enabledSlashSkills = useMemo(
    () => slashSkills.filter((skill) => skill.enabled !== false),
    [slashSkills],
  );

  // Show the loading popover when the user is composing a `/` token but the
  // skill list hasn't resolved yet. Same token rule as the picker so plain
  // sentences containing "/" never surface it.
  const showSlashSkillsLoading =
    slashSkillsLoading && !slashPicker.open && !!slashContext;

  const handleSelectPrompt = (promptText: string) => {
    setInputValue(promptText);
    setIsPromptGalleryOpen(false);
  };

  const { handleMicrophoneBtnClick, processing, recording, time } =
    useVoiceChat({
      onTranscript: (text) =>
        setInputValue(
          inputValue.trim() ? `${inputValue.trim()} ${text}` : text,
        ),
    });

  // Get attached files from Redux store with a fallback for when the state is not yet available
  const attachedFiles = useAppSelector(
    (state: RootState) => state.files.attachedFiles || [],
  );

  // Check if any files are currently uploading
  const hasUploadingFiles = attachedFiles.some(
    (file) =>
      file.uploadStatus === 'pending' || file.uploadStatus === 'uploading',
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Prevent submission when chat is disabled, files are uploading, or session not ready
    if (isSendDisabled || hasUploadingFiles) return;
    // Skill invocations travel inline as `/slug` tokens in the text — the
    // agent discovers skills from its filesystem, so they're prompt hints,
    // not server-side commands.
    onSubmit(inputValue);
    setInputValue('');
    setFileAddedNotification(null);
  };

  const openPromptGallery = () => {
    setIsPromptGalleryOpen(true);
  };

  const handleRemoveFile = (id: string) => {
    dispatch(removeFile(id));
  };

  const processFiles = async (files: File[]) => {
    if (files.length === 0) return;

    // Show notification
    setFileAddedNotification(
      `Uploading ${files.length} file${files.length > 1 ? 's' : ''}...`,
    );

    // Upload files (validation happens inside the hook)
    await uploadFiles(files);

    // Hide notification after upload completes
    setTimeout(() => {
      setFileAddedNotification(null);
    }, 3000);
  };

  const handleFileInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    if (e.target.files && e.target.files.length > 0) {
      await processFiles(Array.from(e.target.files));

      // Reset the input that fired so the same file/photo can be selected again if needed
      e.target.value = '';
    }
  };

  const handleCameraCapture = (file: File) => {
    void processFiles([file]);
  };

  const triggerFileInput = () => {
    if (fileUploadInputRef.current) {
      fileUploadInputRef.current.click();
    }
  };

  const triggerCameraInput = () => {
    if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  const handleCameraClick = () => {
    if (isMobileOS) {
      triggerCameraInput();
    } else {
      setIsCameraDialogOpen(true);
    }
  };

  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setInputValue(text);
    // Runs after setInputValue (which resets the context) so the freshly
    // derived token wins within this batch.
    updateSlashContext(text, e.target.selectionStart ?? text.length);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (!e.clipboardData) return;
    const files = extractFilesFromClipboard(e.clipboardData);
    if (files.length) {
      e.preventDefault();
      void processFiles(files);
      return;
    }
    const text = e.clipboardData.getData('text/plain');
    const parsedMax = Number(config.maximumCharacterSizeToCopy());
    const maxCharacters =
      Number.isFinite(parsedMax) && parsedMax > 0
        ? parsedMax
        : DEFAULT_MAX_CHARACTERS_TO_COPY;
    if (text.length > maxCharacters) {
      e.preventDefault();
      void processFiles([
        new File([text], `pasted-${Date.now()}.txt`, { type: 'text/plain' }),
      ]);
    }
  };

  const textAreaPlaceholder = () => {
    if (recording) {
      const formattedTime = format(new Date(time), 'mm:ss');
      return `Listening... ${formattedTime}`;
    }
    if (processing) {
      return 'Processing...';
    }
    return persistentChatInputLabel ? '' : 'Ask anything';
  };

  return (
    <>
      {isTabletOrMobile && !isPreviewMode && !embedMode && !compactMode && (
        <div
          className="mx-auto flex w-full justify-end pt-4 pl-4"
          style={
            chatAreaMaxWidth ? { maxWidth: `${chatAreaMaxWidth}px` } : undefined
          }
        >
          <RetrievedDocumentsButton sessionId={sessionId} />
        </div>
      )}
      {mentorSettings?.data?.disclaimer && !compactMode && (
        <div
          className="mx-auto mt-1 w-full pb-1"
          style={
            chatAreaMaxWidth ? { maxWidth: `${chatAreaMaxWidth}px` } : undefined
          }
        >
          <p
            id="chat-input-disclaimer"
            className="text-center text-[0.625rem] text-gray-500 italic"
          >
            {mentorSettings?.data?.disclaimer}
          </p>
        </div>
      )}
      <form
        ref={containerRef}
        onSubmit={handleSubmit}
        className={cn(
          'relative mx-auto mt-4 w-full pb-2',
          CSS_CLASS_NAMES.CHAT.TEXTAREA,
        )}
        style={
          chatAreaMaxWidth ? { maxWidth: `${chatAreaMaxWidth}px` } : undefined
        }
      >
        {/* Anchored to the form (not the overflow-hidden composer box) so the
            listbox can extend above the composer without being clipped. */}
        {slashPicker.open && (
          <SlashSkillPicker
            skills={slashPicker.filteredSkills}
            activeIndex={slashPicker.activeIndex}
            listboxId={slashPicker.listboxId}
            onSelect={slashPicker.selectSkill}
            onActiveIndexChange={slashPicker.setActiveIndex}
            isFetchingMore={isFetchingMoreSkills}
            hasMore={hasMoreSkills}
            onLoadMore={loadMoreSkills}
          />
        )}
        {showSlashSkillsLoading && (
          <div
            className="absolute right-0 bottom-full left-0 z-50 mb-2"
            data-testid="slash-skill-loading"
          >
            <div
              role="status"
              aria-live="polite"
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2 shadow-lg"
            >
              <Loader2
                className="h-4 w-4 animate-spin text-gray-400"
                aria-hidden="true"
              />
              <span className="text-sm text-gray-500">Loading skills…</span>
            </div>
          </div>
        )}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-[#fbfbfb] pb-3 shadow-xs">
          <FileAttachmentsList
            attachedFiles={attachedFiles}
            onRemoveFile={handleRemoveFile}
            onRetryFile={retryUpload}
          />

          {fileAddedNotification && (
            <div className="animate-in slide-in-from-bottom-5 absolute top-0 right-0 left-0 -mt-10 flex items-center gap-2 rounded-md bg-blue-50 p-2 text-xs text-blue-600 duration-300">
              <FileText className="h-3 w-3" />
              <span className="truncate">{fileAddedNotification}</span>
            </div>
          )}

          <div className="grid">
            <label
              id="chat-input-label"
              htmlFor="chat-input-textarea"
              className={cn(
                persistentChatInputLabel
                  ? 'block px-[18.5px] pt-3 text-xs font-medium text-gray-600'
                  : 'sr-only',
              )}
            >
              Ask anything
            </label>
            <div className="relative">
              {/* Highlight backdrop — mirrors the textarea's text metrics
                  (font, padding, wrapping) and, while a token is present,
                  renders ALL the text (the textarea's own text goes
                  transparent below) so `/skill` tokens can be styled like
                  active tool pills — blue text included, which a textarea
                  cannot do for a substring. Scroll-synced via onScroll. */}
              {skillTokenSegments && (
                <div
                  ref={highlightBackdropRef}
                  aria-hidden="true"
                  data-testid="skill-highlight-backdrop"
                  className="pointer-events-none absolute inset-0 max-h-32 overflow-hidden px-4 pt-2 pb-1 text-base break-words whitespace-pre-wrap text-gray-900"
                >
                  {skillTokenSegments}
                </div>
              )}
              <AutoResizeTextarea
                id="chat-input-textarea"
                aria-labelledby="chat-input-label"
                aria-describedby={
                  mentorSettings?.data?.disclaimer
                    ? 'chat-input-disclaimer'
                    : undefined
                }
                {...(slashSkills.length > 0 && {
                  role: 'combobox',
                  'aria-expanded': slashPicker.open,
                  'aria-haspopup': 'listbox' as const,
                  'aria-controls': slashPicker.open
                    ? slashPicker.listboxId
                    : undefined,
                  'aria-activedescendant': slashPicker.activeOptionId,
                  'aria-autocomplete': 'list' as const,
                })}
                value={inputValue}
                onChange={handleInputChange}
                onPaste={handlePaste}
                onSubmit={handleSubmit}
                onComposerKeyDown={handleComposerKeyDown}
                sessionId={sessionId}
                isPreviewMode={isPreviewMode}
                textAreaRows={textAreaRows}
                placeholder={
                  isChatDisabledByRbac && !hasShareableToken
                    ? "Sorry about that! You don't have permission to chat."
                    : textAreaPlaceholder()
                }
                disabled={isChatDisabledByRbac || hasUploadingFiles}
                allowEmptySubmit={attachedFiles.length > 0}
                allowAnonymousAccess={
                  isMentorViewableByAnyone ||
                  showingSharedChat ||
                  !!userIsVisiting
                }
                embedMode={embedMode}
                // While tokens are highlighted the mirror renders the text;
                // the textarea only shows the caret and (translucent)
                // selection so the pill's blue text reads through.
                className={cn(
                  'relative',
                  skillTokenSegments &&
                    'text-transparent caret-gray-900 selection:bg-blue-500/20',
                )}
                onScroll={(e: React.UIEvent<HTMLTextAreaElement>) => {
                  if (highlightBackdropRef.current) {
                    highlightBackdropRef.current.scrollTop =
                      e.currentTarget.scrollTop;
                  }
                }}
              />
            </div>
            <div className="flex items-center gap-2 px-2">
              {visibleToLoggedInUsersOnly && !compactMode && (
                <UploadMenu
                  onFileInputTrigger={() =>
                    executeWithTrialCheck(triggerFileInput)
                  }
                  onCameraTrigger={() =>
                    executeWithTrialCheck(handleCameraClick)
                  }
                  disabled={isSendDisabled}
                />
              )}

              {visibleToLoggedInUsersOnly && !compactMode && (
                <InsideButtons
                  sessionId={sessionId}
                  containerWidth={containerWidth}
                  activeOptions={activeTools}
                  onOptionClick={updateSessionTools}
                  deepResearch={deepResearch}
                  artifactsEnabled={artifactsEnabled}
                  disabled={isChatDisabledByRbac}
                  onOpenPromptGallery={openPromptGallery}
                  embedMode={embedMode}
                  promptsIsEnabled={promptsIsEnabled}
                  studyMode={studyMode}
                  memoryEnabled={mentorSettings.data.memoryEnabled}
                  isPrivate={chatPrivacyActive}
                  tenantKey={tenantKey}
                  username={username}
                  skills={enabledSlashSkills}
                  activeSkillSlugs={activeSkillSlugs}
                  onToggleSkill={toggleSkillToken}
                  onClearSkills={clearSkillTokens}
                  hasMoreSkills={hasMoreSkills}
                  isFetchingMoreSkills={isFetchingMoreSkills}
                  onLoadMoreSkills={loadMoreSkills}
                  skillSync={skillSync}
                />
              )}

              <div className="ml-auto flex">
                {visibleToLoggedInUsersOnly && !compactMode && (
                  <ScreenSharingButton
                    onClick={onScreenSharingClick}
                    isScreenSharingModalOpen={isScreenSharingModalOpen}
                    screenSharing={screenSharing}
                    isPreviewMode={isPreviewMode}
                    disabled={isChatDisabledByRbac}
                  />
                )}

                {visibleToLoggedInUsersOnly && !compactMode && (
                  <VoiceChatButton
                    isPreviewMode={isPreviewMode}
                    handleMicrophoneBtnClick={() =>
                      executeWithTrialCheck(handleMicrophoneBtnClick)
                    }
                    processing={processing}
                    recording={recording}
                    disabled={isChatDisabledByRbac}
                  />
                )}

                {visibleToLoggedInUsersOnly && !compactMode && (
                  <VoiceCallButton
                    isPreviewMode={isPreviewMode}
                    onClick={() => executeWithTrialCheck(onPhoneCallClick)}
                    disabled={isChatDisabledByRbac}
                  />
                )}

                {isStreaming ? (
                  <StopStreamingButton stopGenerating={stopGenerating} />
                ) : (
                  <SubmitMessageButton
                    isPreviewMode={isPreviewMode}
                    allowAnonymousAccess={isMentorViewableByAnyone}
                    isUploading={hasUploadingFiles}
                    disabled={isSendDisabled}
                    isConnecting={isConnecting}
                  />
                )}
              </div>
            </div>
          </div>

          <input
            type="file"
            ref={fileUploadInputRef}
            className="hidden"
            onChange={handleFileInputChange}
            accept={
              fileUploadCapabilities.allSupportedTypes.length > 0
                ? fileUploadCapabilities.allSupportedTypes.join(',')
                : MENTOR_CHAT_DOCUMENTS_EXTENSIONS.join(',')
            }
            multiple
            disabled={isSendDisabled}
          />

          <input
            type="file"
            ref={cameraInputRef}
            className="hidden"
            onChange={handleFileInputChange}
            accept="image/*"
            capture="environment"
            disabled={isSendDisabled}
          />
        </div>

        {visibleToLoggedInUsersOnly && !compactMode && (
          <div className="flex w-full justify-center">
            <OutsideButtons
              activeOptions={activeTools}
              onOptionClick={updateSessionTools}
              setSessionTools={setSessionTools}
              onCrossClick={updateSessionTools}
              containerWidth={containerWidth}
              enableWebBrowsing={enableWebBrowsing}
              imageGeneration={imageGeneration}
              codeInterpreter={codeInterpreter}
              googleSlidesIsEnabled={googleSlidesIsEnabled}
              googleDocumentIsEnabled={googleDocumentIsEnabled}
              tenantKey={tenantKey}
              userId={username}
              disabled={isChatDisabledByRbac}
            />
          </div>
        )}
      </form>

      {isPromptGalleryOpen && (
        <PromptGalleryModal
          isOpen={isPromptGalleryOpen}
          onClose={() => setIsPromptGalleryOpen(false)}
          onSelectPrompt={handleSelectPrompt}
        />
      )}
      {isFreeTrialModalOpen && FreeTrialDialog && (
        <FreeTrialDialog
          isOpen={isFreeTrialModalOpen}
          onClose={closeFreeTrialModal}
        />
      )}
      <CameraCaptureDialog
        open={isCameraDialogOpen}
        onOpenChange={setIsCameraDialogOpen}
        onCapture={handleCameraCapture}
        facingMode={isMobileOS ? 'environment' : 'user'}
      />
    </>
  );
}
