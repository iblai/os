import React, {
  useRef,
  useEffect,
  useState,
  TextareaHTMLAttributes,
} from 'react';
import { useAppSelector } from '@/lib/hooks';
import { selectNumberOfActiveChatMessages } from '@iblai/iblai-js/web-utils';

interface AutoResizeTextareaProps
  extends Omit<
    TextareaHTMLAttributes<HTMLTextAreaElement>,
    'onChange' | 'onSubmit'
  > {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  onSubmit: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  disabled?: boolean;
  placeholder?: string;
  sessionId?: string | null;
  isPreviewMode?: boolean;
  textAreaRows?: number;
  className?: string;
  style?: React.CSSProperties;
  allowAnonymousAccess?: boolean;
  allowEmptySubmit?: boolean;
  embedMode?: boolean;
  'aria-labelledby'?: string;
  'aria-describedby'?: string;
  id?: string;
}

const AutoResizeTextarea: React.FC<AutoResizeTextareaProps> = ({
  allowEmptySubmit = false,
  value,
  onChange,
  onSubmit,
  disabled = false,
  placeholder = '',
  sessionId = null,
  isPreviewMode = false,
  textAreaRows = 3,
  className = '',
  style = {},
  allowAnonymousAccess = false,
  embedMode = false,
  ...props
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [isResizing, setIsResizing] = useState(false);
  const numberOfMessages = useAppSelector(selectNumberOfActiveChatMessages);

  const adjustHeight = (): void => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = 'auto';
    textarea.style.height = `${textarea.scrollHeight}px`;
  };

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    let resizeObserver: ResizeObserver | undefined;

    if (window.ResizeObserver) {
      resizeObserver = new ResizeObserver(() => {
        if (!isResizing) {
          setIsResizing(true);
          requestAnimationFrame(() => {
            adjustHeight();
            setIsResizing(false);
          });
        }
      });

      resizeObserver.observe(textarea);
    }

    // Initial height adjustment
    // adjustHeight();

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
    };
  }, []);

  useEffect(() => {
    adjustHeight();
  }, [value]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLTextAreaElement>,
  ): void => {
    onChange(e);
    if (!isResizing) {
      adjustHeight();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>): void => {
    if (isPreviewMode && !allowAnonymousAccess) return;

    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() || allowEmptySubmit) {
        onSubmit(e);
      }
    }
  };

  const getMinHeight = (): string => {
    if (numberOfMessages === 0 && !embedMode) {
      return '56px'; // Reduced from 100px for better mobile experience
    }
    return `${textAreaRows * 20}px`;
  };

  const combinedStyle: React.CSSProperties = {
    minHeight: getMinHeight(),
    ...style,
  };

  return (
    <textarea
      ref={textareaRef}
      value={value}
      onChange={handleInputChange}
      onKeyDown={handleKeyDown}
      disabled={
        (!sessionId && !allowAnonymousAccess) ||
        (isPreviewMode && !allowAnonymousAccess) ||
        disabled
      }
      placeholder={placeholder}
      style={combinedStyle}
      className={`flex max-h-32 min-h-[36px] w-full resize-none rounded-2xl border-0 border-gray-200 bg-transparent px-4 py-2 pt-2 pb-1 text-base ring-offset-white placeholder:text-gray-400 focus:outline-none focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-gray-800 dark:bg-gray-950 dark:ring-offset-gray-950 dark:placeholder:text-gray-400 ${className}`}
      {...props}
    />
  );
};

export default AutoResizeTextarea;
