'use client';

import {type ReactNode, useEffect, useId, useRef, useState, useSyncExternalStore} from 'react';
import {Bot, Mail, MessageCircle, Phone, X} from 'lucide-react';

import type {PublicContactSettings} from '@/features/contact/types';
import {resolveZaloOAUrl} from '@/features/contact/zalo';

type FloatingContactWidgetProps = {
  contact: PublicContactSettings;
  isVisible: boolean;
  isZaloChatOpen?: boolean;
  onOpenChat: () => void;
  onOpenZaloChat?: () => void;
  onPositionZaloLauncher?: (x: number, y: number) => void;
  onResetZaloLauncher?: () => void;
  zaloWidget?: ReactNode;
};

function ZaloIcon() {
  return (
    <svg aria-hidden='true' viewBox='0 0 48 48' className='h-7 w-7'>
      <rect width='48' height='48' rx='14' fill='#0068FF' />
      <text
        x='24'
        y='29.5'
        textAnchor='middle'
        fill='#FFFFFF'
        fontSize='15'
        fontWeight='900'
        fontFamily='system-ui, -apple-system, sans-serif'
        letterSpacing='-0.5'
      >
        Zalo
      </text>
    </svg>
  );
}

function ZaloSmallIcon() {
  return (
    <svg aria-hidden='true' viewBox='0 0 48 48' className='h-5 w-5'>
      <rect width='48' height='48' rx='12' fill='#0068FF' />
      <text
        x='24'
        y='30'
        textAnchor='middle'
        fill='#FFFFFF'
        fontSize='16'
        fontWeight='900'
        fontFamily='system-ui, -apple-system, sans-serif'
        letterSpacing='-0.5'
      >
        Zalo
      </text>
    </svg>
  );
}

function MessengerIcon() {
  return (
    <svg aria-hidden='true' viewBox='0 0 48 48' className='h-5 w-5'>
      <defs>
        <radialGradient id='support-messenger-gradient' cx='19.2%' cy='99.47%' r='108.96%'>
          <stop offset='0' stopColor='#0099FF' />
          <stop offset='.61' stopColor='#A033FF' />
          <stop offset='.935' stopColor='#FF5280' />
          <stop offset='1' stopColor='#FF7061' />
        </radialGradient>
      </defs>
      <path
        fill='url(#support-messenger-gradient)'
        d='M24 4C12.954 4 4 12.284 4 22.5c0 5.82 2.91 11 7.455 14.388V44l6.814-3.74c1.817.5 3.74.773 5.731.773 11.046 0 20-8.284 20-18.5S35.046 4 24 4Z'
      />
      <path fill='white' d='m11.5 28.75 7.6-8.1 5.5 4.1 7.9-4.1-8.6 9.1-5.3-4.1-7.1 3.1Z' />
    </svg>
  );
}

export default function FloatingContactWidget({
  contact,
  isVisible,
  isZaloChatOpen = false,
  onOpenChat,
  onOpenZaloChat,
  onPositionZaloLauncher,
  onResetZaloLauncher,
  zaloWidget,
}: FloatingContactWidgetProps) {
  const [expanded, setExpanded] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const menuId = useId();
  const isHydrated = useSyncExternalStore(
    () => () => undefined,
    () => true,
    () => false,
  );


  useEffect(() => {
    if (!expanded) return;

    const closeOnOutsideClick = (event: PointerEvent) => {
      if (event.target instanceof Node && !widgetRef.current?.contains(event.target)) {
        setExpanded(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };

    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [expanded]);

  const [prevIsZaloChatOpen, setPrevIsZaloChatOpen] = useState(isZaloChatOpen);
  if (prevIsZaloChatOpen !== isZaloChatOpen) {
    setPrevIsZaloChatOpen(isZaloChatOpen);
    if (isZaloChatOpen) {
      setExpanded(false);
    }
  }

  if (!isVisible) return null;

  const closeMenu = () => {
    setExpanded(false);
    onResetZaloLauncher?.();
  };
  const zaloHref = (contact.zalo_oa_id || contact.zalo_url)
    ? resolveZaloOAUrl(contact.zalo_oa_id, contact.zalo_url)
    : undefined;

  const handleOpenZaloOA = (e: React.MouseEvent<HTMLAnchorElement>) => {
    const isMobile = typeof window !== 'undefined'
      && (window.innerWidth < 640 || /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent));

    if (isMobile) {
      closeMenu();
      return;
    }

    if (onOpenZaloChat) {
      e.preventDefault();
      setExpanded(false);
      onOpenZaloChat();
    } else {
      closeMenu();
    }
  };

  return (
    <div
      ref={widgetRef}
      className='fixed bottom-[calc(4.75rem+env(safe-area-inset-bottom))] right-3 z-[45] flex flex-col items-end sm:bottom-6 sm:right-6'
      data-testid='floating-contact-widget'
    >
      <>
          {expanded && <button
            type='button'
            aria-label='Đóng bảng hỗ trợ'
            className='fixed inset-0 -z-10 bg-black/20 backdrop-blur-[1px] sm:hidden'
            onClick={closeMenu}
          />}
          <section
            hidden={!expanded && !isZaloChatOpen}
            id={menuId}
            aria-label='Các kênh hỗ trợ Maian Homes'
            className='fixed inset-x-3 bottom-[calc(8.5rem+env(safe-area-inset-bottom))] overflow-hidden rounded-3xl border border-[#E8E0D8] bg-white shadow-[0_24px_70px_rgba(45,27,20,0.24)] sm:absolute sm:inset-x-auto sm:bottom-full sm:right-0 sm:mb-3 sm:w-[22rem]'
            data-testid='support-channel-menu'
            onPointerLeave={() => onResetZaloLauncher?.()}
          >
            <div
              className='border-b border-stone-100 bg-[#FAF8F5] px-5 py-4'
              onPointerEnter={() => onResetZaloLauncher?.()}
            >
              <p className='text-sm font-bold text-[#2D1B14]'>Maian Homes hỗ trợ bạn</p>
              <p className='mt-0.5 text-xs text-stone-500'>Chọn kênh phù hợp với nhu cầu của bạn</p>
            </div>

            <div className='space-y-2.5 p-3.5'>
              {(contact.zalo_oa_id || contact.zalo_url) && (
                <div
                  className='relative min-h-16 overflow-visible rounded-2xl'
                  onPointerEnter={(e) => onPositionZaloLauncher?.(e.clientX, e.clientY)}
                  onPointerMove={(e) => onPositionZaloLauncher?.(e.clientX, e.clientY)}
                >
                  <a
                    href={zaloHref}
                    target='_blank'
                    rel='noopener noreferrer'
                    className='group flex min-h-16 w-full items-center gap-3 rounded-2xl border border-blue-100 bg-blue-50/70 px-3.5 py-3 text-left transition hover:border-blue-200 hover:bg-blue-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600'
                    aria-label='Nhắn Zalo với nhân viên'
                    onClick={handleOpenZaloOA}
                  >
                    <span className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white shadow-sm'>
                      <ZaloIcon />
                    </span>
                    <span className='min-w-0 flex-1'>
                      <span className='block text-sm font-bold text-stone-900'>Nhắn Zalo với nhân viên</span>
                      <span className='mt-0.5 block text-xs text-stone-500'>Mở cửa sổ chat Zalo OA</span>
                    </span>
                    <span className='rounded-full bg-blue-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-white'>
                      Nhân viên
                    </span>
                  </a>
                  {zaloWidget}
                </div>
              )}

              <button
                type='button'
                className='group flex min-h-16 w-full items-center gap-3 rounded-2xl border border-indigo-100 bg-indigo-50/70 px-3.5 py-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600'
                aria-label='Hỏi trợ lý Mái Đỏ'
                onPointerEnter={() => onResetZaloLauncher?.()}
                onClick={() => {
                  closeMenu();
                  onOpenChat();
                }}
              >
                <span className='flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-600 to-indigo-700 text-white shadow-sm'>
                  <Bot className='h-5 w-5' aria-hidden='true' />
                </span>
                <span className='min-w-0 flex-1'>
                  <span className='block text-sm font-bold text-stone-900'>Hỏi trợ lý Mái Đỏ</span>
                  <span className='mt-0.5 block text-xs text-stone-500'>Phản hồi tự động mọi lúc</span>
                </span>
                <span className='rounded-full bg-indigo-100 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-indigo-700'>
                  24/7
                </span>
              </button>

              {(contact.phone_href || contact.messenger_url || zaloHref || contact.email_href) && (
                <div
                  className={`grid gap-2 border-t border-stone-100 pt-3 ${
                    [contact.phone_href, contact.messenger_url, zaloHref, contact.email_href].filter(Boolean).length === 4
                      ? 'grid-cols-4'
                      : [contact.phone_href, contact.messenger_url, zaloHref, contact.email_href].filter(Boolean).length === 3
                        ? 'grid-cols-3'
                        : 'grid-cols-2'
                  }`}
                  onPointerEnter={() => onResetZaloLauncher?.()}
                >
                  {contact.phone_href && (
                    <a
                      href={contact.phone_href}
                      className='flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold text-stone-600 transition hover:bg-emerald-50 hover:text-emerald-700 focus-visible:outline-2 focus-visible:outline-emerald-600'
                      aria-label='Gọi điện tư vấn'
                      onClick={closeMenu}
                    >
                      <Phone className='h-5 w-5' aria-hidden='true' />
                      Gọi điện
                    </a>
                  )}
                  {contact.messenger_url && (
                    <a
                      href={contact.messenger_url}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold text-stone-600 transition hover:bg-violet-50 hover:text-violet-700 focus-visible:outline-2 focus-visible:outline-violet-600'
                      aria-label='Liên hệ qua Messenger'
                      onClick={closeMenu}
                    >
                      <MessengerIcon />
                      Messenger
                    </a>
                  )}
                  {zaloHref && (
                    <a
                      href={zaloHref}
                      target='_blank'
                      rel='noopener noreferrer'
                      className='flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold text-stone-600 transition hover:bg-blue-50 hover:text-blue-700 focus-visible:outline-2 focus-visible:outline-blue-600'
                      aria-label='Nhắn tin Zalo OA'
                      onClick={handleOpenZaloOA}
                    >
                      <ZaloSmallIcon />
                      Zalo OA
                    </a>
                  )}
                  {contact.email_href && (
                    <a
                      href={contact.email_href}
                      className='flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl text-xs font-semibold text-stone-600 transition hover:bg-amber-50 hover:text-amber-700 focus-visible:outline-2 focus-visible:outline-amber-600'
                      aria-label='Gửi email'
                      onClick={closeMenu}
                    >
                      <Mail className='h-5 w-5' aria-hidden='true' />
                      Email
                    </a>
                  )}
                </div>
              )}
            </div>
          </section>
        </>

      <button
        type='button'
        disabled={!isHydrated}
        onClick={() => setExpanded((current) => !current)}
        className='flex h-12 items-center justify-center gap-2 rounded-full border border-[#D4AF37]/60 bg-[#1A1612] px-4 text-[#F4D77D] shadow-[0_10px_28px_rgba(26,22,18,0.32)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-[#2C241A] active:scale-95 disabled:cursor-wait disabled:opacity-70 motion-reduce:transform-none motion-reduce:transition-none'
        aria-label={expanded ? 'Đóng menu hỗ trợ' : 'Mở menu hỗ trợ'}
        aria-expanded={expanded}
        aria-controls={menuId}
      >
        {expanded ? (
          <X className='h-5 w-5' aria-hidden='true' />
        ) : (
          <MessageCircle className='h-5 w-5' aria-hidden='true' />
        )}
        <span className='text-sm font-bold'>{expanded ? 'Đóng' : 'Hỗ trợ'}</span>
      </button>
    </div>
  );
}
