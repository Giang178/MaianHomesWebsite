'use client';

import Script from 'next/script';
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';

import {isValidZaloOAId, resolveZaloOAUrl} from '@/features/contact/zalo';

const ZALO_SDK_URL = 'https://sp.zalo.me/plugins/sdk.js';
const ZALO_WIDGET_ORIGINS = new Set([
  'https://page.widget.zalo.me',
  'https://sp.zalo.me',
]);
const OPEN_RETRY_DELAYS_MS = [250, 750, 1_500, 3_000, 5_000] as const;

type ZaloSocialSDK = {
  reload?: () => void;
  openChatWidget?: () => void;
  closeChatWidget?: () => void;
};

declare global {
  interface Window {
    ZaloSocialSDK?: ZaloSocialSDK;
  }
}

export type ZaloOAChatWidgetHandle = {
  open: () => boolean;
  close: () => void;
  positionLauncher?: (x: number, y: number) => void;
  resetLauncher?: () => void;
};

type ZaloOAChatWidgetProps = {
  oaId: string | null | undefined;
  fallbackUrl: string | null | undefined;
  onOpenChange?: (isOpen: boolean) => void;
};

const ZaloOAChatWidget = forwardRef<ZaloOAChatWidgetHandle, ZaloOAChatWidgetProps>(
  function ZaloOAChatWidget({oaId, fallbackUrl, onOpenChange}, ref) {
    const [isOpen, setIsOpen] = useState(false);
    const retryTimersRef = useRef<number[]>([]);
    const pendingOpenRef = useRef(false);
    const widgetRef = useRef<HTMLDivElement>(null);
    const validOaId = isValidZaloOAId(oaId) ? oaId : null;

    const clearOpenRetries = useCallback(() => {
      retryTimersRef.current.forEach((timer) => window.clearTimeout(timer));
      retryTimersRef.current = [];
    }, []);

    const setChatOpen = useCallback((nextOpen: boolean) => {
      setIsOpen(nextOpen);
      onOpenChange?.(nextOpen);
    }, [onOpenChange]);

    const requestSdkOpen = useCallback(() => {
      try {
        if (typeof window.ZaloSocialSDK?.openChatWidget !== 'function') return false;
        window.ZaloSocialSDK.openChatWidget();
        return true;
      } catch {
        return false;
      }
    }, []);

    const hasExpandedChatFrame = useCallback(() => {
      const iframe = widgetRef.current?.querySelector('iframe');
      if (!iframe) return false;

      const declaredHeight = Number.parseInt(iframe.getAttribute('height') ?? '', 10);
      return Number.isFinite(declaredHeight) && declaredHeight >= 200;
    }, []);

    const openFallback = useCallback(() => {
      const targetUrl = resolveZaloOAUrl(validOaId, fallbackUrl);
      window.open(targetUrl, '_blank', 'noopener,noreferrer');
    }, [fallbackUrl, validOaId]);

    const isOpenRef = useRef(false);
    const resetTimerRef = useRef<number | null>(null);

    useEffect(() => {
      isOpenRef.current = isOpen;
      if (isOpen && resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
    }, [isOpen]);

    const positionLauncher = useCallback((x: number, y: number) => {
      if (isOpenRef.current || !widgetRef.current) return;
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }
      const el = widgetRef.current;
      el.style.setProperty('position', 'fixed', 'important');
      el.style.setProperty('left', `${x - 30}px`, 'important');
      el.style.setProperty('top', `${y - 35}px`, 'important');
      el.style.setProperty('bottom', 'auto', 'important');
      el.style.setProperty('right', 'auto', 'important');
      el.style.setProperty('width', '60px', 'important');
      el.style.setProperty('height', '60px', 'important');
      el.style.setProperty('opacity', '0.001', 'important');
      el.style.setProperty('pointer-events', 'auto', 'important');
      el.style.setProperty('z-index', '50', 'important');
      el.style.removeProperty('overflow');
    }, []);

    const resetLauncher = useCallback((immediate = false) => {
      if (isOpenRef.current || !widgetRef.current) return;
      if (resetTimerRef.current !== null) {
        window.clearTimeout(resetTimerRef.current);
        resetTimerRef.current = null;
      }

      const doReset = () => {
        if (!widgetRef.current || isOpenRef.current) return;
        const el = widgetRef.current;
        el.style.setProperty('position', 'fixed', 'important');
        el.style.setProperty('left', '-9999px', 'important');
        el.style.setProperty('top', '-9999px', 'important');
        el.style.setProperty('bottom', 'auto', 'important');
        el.style.setProperty('right', 'auto', 'important');
        el.style.setProperty('opacity', '0', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
      };

      if (immediate) {
        doReset();
      } else {
        resetTimerRef.current = window.setTimeout(doReset, 180);
      }
    }, []);

    useEffect(() => {
      return () => {
        if (resetTimerRef.current !== null) {
          window.clearTimeout(resetTimerRef.current);
          resetTimerRef.current = null;
        }
      };
    }, []);

    useEffect(() => {
      if (!widgetRef.current) return;
      const el = widgetRef.current;
      if (isOpen) {
        el.style.removeProperty('left');
        el.style.removeProperty('top');
        el.style.setProperty('position', 'fixed', 'important');
        el.style.setProperty('bottom', '16px', 'important');
        el.style.setProperty('right', '16px', 'important');
        el.style.setProperty('width', 'min(400px, calc(100vw - 32px))', 'important');
        el.style.setProperty('height', 'min(560px, calc(100dvh - 32px))', 'important');
        el.style.setProperty('overflow', 'hidden', 'important');
        el.style.setProperty('border-radius', '20px', 'important');
        el.style.setProperty('box-shadow', '0 24px 60px rgba(0,0,0,0.22)', 'important');
        el.style.setProperty('opacity', '1', 'important');
        el.style.setProperty('pointer-events', 'auto', 'important');
        el.style.setProperty('z-index', '2147483644', 'important');

        const applyIframeStyles = () => {
          const iframe = el.querySelector('iframe');
          if (iframe) {
            iframe.style.setProperty('position', 'absolute', 'important');
            iframe.style.setProperty('top', '0', 'important');
            iframe.style.setProperty('left', '0', 'important');
            iframe.style.setProperty('width', '100%', 'important');
            iframe.style.setProperty('min-width', '0', 'important');
            iframe.style.setProperty('max-width', '100%', 'important');
            iframe.style.setProperty('height', 'calc(100% + 78px)', 'important');
            iframe.style.setProperty('min-height', 'calc(100% + 78px)', 'important');
            iframe.style.setProperty('max-height', 'none', 'important');
            iframe.style.setProperty('clip-path', 'inset(0 0 65px 0)', 'important');
          }
        };

        applyIframeStyles();
        const raf = window.requestAnimationFrame(applyIframeStyles);
        return () => window.cancelAnimationFrame(raf);
      } else {
        el.style.setProperty('position', 'fixed', 'important');
        el.style.setProperty('left', '-9999px', 'important');
        el.style.setProperty('top', '-9999px', 'important');
        el.style.setProperty('bottom', 'auto', 'important');
        el.style.setProperty('right', 'auto', 'important');
        el.style.setProperty('width', '60px', 'important');
        el.style.setProperty('height', '60px', 'important');
        el.style.setProperty('opacity', '0', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
        el.style.removeProperty('overflow');
        el.style.removeProperty('border-radius');
        el.style.removeProperty('box-shadow');

        const resetIframe = () => {
          const iframe = el.querySelector('iframe');
          if (iframe) {
            iframe.style.removeProperty('clip-path');
            iframe.style.removeProperty('top');
            iframe.style.removeProperty('min-width');
            iframe.style.removeProperty('max-width');
            iframe.style.removeProperty('height');
            iframe.style.removeProperty('min-height');
            iframe.style.removeProperty('max-height');
            iframe.style.removeProperty('width');
            iframe.style.cssText = 'max-height: 90vh; position: absolute; bottom: 0px; right: 0px;';
            iframe.setAttribute('width', '60');
            iframe.setAttribute('height', '60');
          }
        };

        const timer = window.setTimeout(resetIframe, 350);
        return () => window.clearTimeout(timer);
      }
    }, [isOpen]);

    useImperativeHandle(ref, () => ({
      open: () => {
        if (!validOaId || typeof window.ZaloSocialSDK?.openChatWidget !== 'function') {
          openFallback();
          return false;
        }

        pendingOpenRef.current = true;
        clearOpenRetries();
        requestSdkOpen();
        retryTimersRef.current = [
          ...OPEN_RETRY_DELAYS_MS.map((delay) => window.setTimeout(
            () => {
              if (pendingOpenRef.current) requestSdkOpen();
            },
            delay,
          )),
          window.setTimeout(() => {
            if (pendingOpenRef.current) {
              pendingOpenRef.current = false;
              openFallback();
            }
          }, OPEN_RETRY_DELAYS_MS[OPEN_RETRY_DELAYS_MS.length - 1] + 1_000),
        ];
        return true;
      },
      close: () => {
        pendingOpenRef.current = false;
        clearOpenRetries();
        window.ZaloSocialSDK?.closeChatWidget?.();
        setChatOpen(false);
      },
      positionLauncher,
      resetLauncher,
    }), [clearOpenRetries, openFallback, positionLauncher, requestSdkOpen, resetLauncher, setChatOpen, validOaId]);

    useEffect(() => {
      const handleWidgetMessage = (event: MessageEvent) => {
        if (!ZALO_WIDGET_ORIGINS.has(event.origin) || !event.data || typeof event.data !== 'object') {
          return;
        }

        const data = event.data as {cmd?: unknown; height?: unknown; width?: unknown};
        const command = data.cmd;

        if (command === 'zchat_widget_toggle_sticker') {
          const h = Number(data.height);
          if (Number.isFinite(h) && h >= 200) {
            pendingOpenRef.current = false;
            clearOpenRetries();
            setChatOpen(true);
          } else if (Number.isFinite(h) && h <= 100) {
            if (pendingOpenRef.current) {
              retryTimersRef.current.push(window.setTimeout(() => {
                if (pendingOpenRef.current) requestSdkOpen();
              }, 0));
              return;
            }
            clearOpenRetries();
            setChatOpen(false);
          }
        } else if (command === 'zchat_widget_open_chat_box') {
          const h = Number(data.height);
          if (Number.isFinite(h) && h >= 200) {
            pendingOpenRef.current = false;
            clearOpenRetries();
            setChatOpen(true);
          } else {
            retryTimersRef.current.push(window.setTimeout(() => {
              if (hasExpandedChatFrame()) {
                pendingOpenRef.current = false;
                clearOpenRetries();
                setChatOpen(true);
              } else if (pendingOpenRef.current) {
                requestSdkOpen();
              }
            }, 0));
          }
        } else if (command === 'zchat_widget_close_chat_box') {
          if (pendingOpenRef.current) {
            retryTimersRef.current.push(window.setTimeout(() => {
              if (pendingOpenRef.current) requestSdkOpen();
            }, 0));
            return;
          }
          clearOpenRetries();
          setChatOpen(false);
        }
      };

      window.addEventListener('message', handleWidgetMessage);
      return () => {
        clearOpenRetries();
        window.removeEventListener('message', handleWidgetMessage);
      };
    }, [clearOpenRetries, hasExpandedChatFrame, requestSdkOpen, setChatOpen]);

    if (!validOaId) return null;

    return (
      <>
        <div
          ref={widgetRef}
          className={`zalo-chat-widget ${
            isOpen
              ? 'fixed bottom-4 right-4 z-[2147483644] overflow-hidden rounded-[20px] shadow-[0_24px_60px_rgba(0,0,0,0.22)] w-[min(400px,calc(100vw-32px))] h-[min(560px,calc(100dvh-32px))] [&_iframe]:!absolute [&_iframe]:!top-0 [&_iframe]:!left-0 [&_iframe]:!w-full [&_iframe]:!min-w-0 [&_iframe]:!max-w-full [&_iframe]:!h-[calc(100%+78px)] [&_iframe]:!min-h-[calc(100%+78px)] [&_iframe]:!max-h-none [&_iframe]:![clip-path:inset(0_0_65px_0)]'
              : ''
          }`}
          style={
            isOpen
              ? undefined
              : {
                  position: 'fixed',
                  left: '-9999px',
                  top: '-9999px',
                  opacity: 0,
                  pointerEvents: 'none',
                }
          }
          data-oaid={validOaId}
          data-welcome-message='Xin chào! Maian Homes có thể hỗ trợ gì cho bạn?'
          data-autopopup='0'
          data-width='350'
          data-height='420'
          data-style='2'
          data-testid='zalo-oa-chat-widget'
          data-state={isOpen ? 'open' : 'closed'}
          aria-hidden={!isOpen}
        />
        <Script
          id='zalo-social-sdk'
          src={ZALO_SDK_URL}
          strategy='lazyOnload'
        />
      </>
    );
  },
);

export default ZaloOAChatWidget;
