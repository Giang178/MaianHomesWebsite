'use client';

import { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2, Phone, PhoneCall, RotateCcw, Send, Sparkles, X } from 'lucide-react';
import { submitPublicLead } from '@/features/inquiries/api';

interface ChatWindowProps { isOpen: boolean; onClose: () => void; phone?: string | null; }
interface ChatMessage { role: 'user' | 'assistant'; content: string; }
interface ChatSource { title: string; url: string; type: 'company' | 'project' | 'article'; }
interface SuggestedAction { type: string; label: string; note?: string; }
type ChatStatus = 'online' | 'busy' | 'unavailable';

const GREETING = 'Xin chào! Tôi là Mái Đỏ, trợ lý thông tin của Maian Homes. Tôi có thể hỗ trợ thông tin công ty và các dự án đã được xuất bản.';
const CHAT_ENDPOINT = '/api/public/ai/chat';
const MAX_CONTEXT_MESSAGES = 10;

export default function ChatWindow({ isOpen, onClose, phone }: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: GREETING }]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<ChatStatus>('online');
  const [language, setLanguage] = useState<'vi' | 'en' | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [sources, setSources] = useState<ChatSource[]>([]);
  const [suggestedAction, setSuggestedAction] = useState<SuggestedAction | null>(null);

  // Lead capture state
  const [showLeadForm, setShowLeadForm] = useState(false);
  const [leadName, setLeadName] = useState('');
  const [leadPhone, setLeadPhone] = useState('');
  const [leadNote, setLeadNote] = useState('');
  const [leadSubmitting, setLeadSubmitting] = useState(false);
  const [leadError, setLeadError] = useState<string | null>(null);
  const [leadSubmitted, setLeadSubmitted] = useState(false);

  const endRef = useRef<HTMLDivElement>(null);
  const requestRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeChatRef = useRef<() => void>(() => undefined);
  const isEnglish = language === 'en';
  const networkFallback = isEnglish
    ? 'Mái Đỏ is temporarily unable to connect. Please try again shortly' + (phone ? ' or call ' + phone : '') + '.'
    : 'Mái Đỏ đang tạm thời mất kết nối. Quý khách vui lòng thử lại sau ít phút' + (phone ? ' hoặc gọi hotline ' + phone : '') + '.';
  const rateLimitFallback = isEnglish
    ? 'You have sent too many messages. Please wait a moment and try again.'
    : 'Quý khách đã gửi quá nhiều tin nhắn. Vui lòng chờ một chút rồi thử lại.';

  useEffect(() => {
    if (typeof endRef.current?.scrollIntoView === 'function') {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, showLeadForm]);
  useEffect(() => () => requestRef.current?.abort(), []);
  useEffect(() => {
    if (!isOpen) {
      setInput('');
      setShowLeadForm(false);
      setLeadError(null);
      return;
    }
    inputRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (showLeadForm) {
          setShowLeadForm(false);
          return;
        }
        closeChatRef.current();
        return;
      }
      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])'));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isOpen, showLeadForm]);

  const resetChat = useCallback(() => {
    requestRef.current?.abort();
    requestRef.current = null;
    if (sessionId) {
      void fetch(`/api/public/ai/chat/session/${encodeURIComponent(sessionId)}`, { method: 'DELETE', credentials: 'include', cache: 'no-store' }).catch(() => undefined);
    }
    setMessages([{ role: 'assistant', content: GREETING }]);
    setInput('');
    setLoading(false);
    setStatus('online');
    setLanguage(null);
    setSessionId(null);
    setSources([]);
    setSuggestedAction(null);
    setShowLeadForm(false);
    setLeadName('');
    setLeadPhone('');
    setLeadNote('');
    setLeadSubmitting(false);
    setLeadError(null);
    setLeadSubmitted(false);
    setTimeout(() => inputRef.current?.focus(), 0);
  }, [sessionId]);

  const closeChat = useCallback(() => {
    resetChat();
    onClose();
  }, [onClose, resetChat]);
  closeChatRef.current = closeChat;

  function appendAssistantChunk(content: string) {
    if (!content) return;
    setMessages((current) => {
      const next = [...current];
      const index = next.length - 1;
      const last = next[index];
      if (last?.role === 'assistant') next[index] = { ...last, content: last.content + content };
      else next.push({ role: 'assistant', content });
      return next;
    });
  }

  function consumeEvent(eventBlock: string) {
    const lines = eventBlock.split('\n');
    const eventName = lines.find(line => line.startsWith('event:'))?.slice(6).trim() || 'message';
    const data = lines.filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
    if (!data || data === '[DONE]') return;
    try {
      const payload = JSON.parse(data) as Record<string, unknown>;
      if (eventName === 'meta') {
        if (payload.language === 'vi' || payload.language === 'en') setLanguage(payload.language);
        if (typeof payload.session_id === 'string' && payload.session_id) setSessionId(payload.session_id);
        setStatus(payload.status === 'unavailable' ? 'unavailable' : 'online');
        if (payload.suggested_action && typeof payload.suggested_action === 'object') {
          setSuggestedAction(payload.suggested_action as SuggestedAction);
        }
      } else if (eventName === 'message') {
        appendAssistantChunk(String(payload.content || ''));
      } else if (eventName === 'sources') {
        setSources(Array.isArray(payload.items) ? payload.items as ChatSource[] : []);
      } else if (eventName === 'error') {
        setStatus('unavailable');
      }
    } catch {
      setStatus('unavailable');
    }
  }

  async function sendMessageText(text: string) {
    const body = text.trim();
    if (!body || loading) return;
    const userMessage: ChatMessage = { role: 'user', content: body };
    const context = [...messages, userMessage].slice(-MAX_CONTEXT_MESSAGES);
    const controller = new AbortController();
    requestRef.current?.abort();
    requestRef.current = controller;
    setMessages((current) => [...current, userMessage]);
    setInput('');
    setLoading(true);
    setStatus('busy');
    setSources([]);
    setSuggestedAction(null);
    let failureMessage = networkFallback;

    try {
      const response = await fetch(CHAT_ENDPOINT, {
        method: 'POST', cache: 'no-store', credentials: 'include',
        headers: { Accept: 'text/event-stream', 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: context, language, session_id: sessionId }), signal: controller.signal,
      });
      if (!response.ok) {
        if (response.status === 429) failureMessage = rateLimitFallback;
        throw new Error('Chat request failed: ' + response.status);
      }
      if (!response.body) throw new Error('Chat response does not contain a stream');
      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
        const events = buffer.split('\n\n');
        buffer = events.pop() || '';
        events.forEach(consumeEvent);
        if (done) break;
      }
      if (buffer.trim()) consumeEvent(buffer);
    } catch (error) {
      const isAbort = 
        (typeof DOMException !== 'undefined' && error instanceof DOMException && error.name === 'AbortError') ||
        (error instanceof Error && error.name === 'AbortError') ||
        (typeof error === 'object' && error !== null && 'name' in error && error.name === 'AbortError');
      if (isAbort) return;
      setStatus('unavailable');
      setMessages((current) => [...current.filter((message) => message.content), {
        role: 'assistant', content: failureMessage,
      }]);
    } finally {
      if (requestRef.current === controller) {
        requestRef.current = null;
        setLoading(false);
      }
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    await sendMessageText(input);
  }

  async function handleLeadSubmit(event: FormEvent) {
    event.preventDefault();
    setLeadError(null);
    const cleanName = leadName.trim();
    const cleanPhone = leadPhone.trim().replace(/[^\d+]/g, '');

    if (!cleanName) {
      setLeadError(isEnglish ? 'Please enter your name' : 'Vui lòng nhập họ và tên');
      return;
    }
    if (!cleanPhone || !/^(0|\+84)\d{8,11}$/.test(cleanPhone)) {
      setLeadError(isEnglish ? 'Invalid phone number (must start with 0)' : 'Số điện thoại không hợp lệ (cần bắt đầu bằng 0)');
      return;
    }

    setLeadSubmitting(true);
    try {
      const recentTopics = messages.filter(m => m.role === 'user').slice(-2).map(m => m.content).join('; ');
      const contextNote = leadNote.trim() || recentTopics || 'Khách hàng để lại thông tin tư vấn qua chatbot Mái Đỏ';

      await submitPublicLead({
        customer_name: cleanName,
        phone: cleanPhone,
        form_id: 'maya-chat-lead',
        source: 'WEBSITE',
        type: 'BUY',
        note: `[Chatbot Mái Đỏ] ${contextNote}`,
        page_url: typeof window !== 'undefined' ? window.location.href : undefined,
        consent: true,
        consent_version: 'website-privacy-v1',
      });

      setShowLeadForm(false);
      setLeadSubmitted(true);
      setLeadName('');
      setLeadPhone('');
      setLeadNote('');
      setMessages((current) => [
        ...current,
        {
          role: 'assistant',
          content: isEnglish
            ? `Thank you, ${cleanName}! Maian Homes has received your request. Our specialist will contact you shortly via ${cleanPhone}.`
            : `Cảm ơn Quý khách ${cleanName}! Maian Homes đã tiếp nhận yêu cầu. Chuyên viên tư vấn sẽ liên hệ hỗ trợ Quý khách sớm nhất qua số ${cleanPhone}.`,
        },
      ]);
    } catch {
      setLeadError(
        isEnglish
          ? 'Could not send request right now. Please try again or call our hotline.'
          : 'Không thể gửi thông tin lúc này. Quý khách vui lòng thử lại hoặc gọi hotline.'
      );
    } finally {
      setLeadSubmitting(false);
    }
  }

  if (!isOpen) return null;
  const dotClass = status === 'online' ? 'h-2 w-2 rounded-full bg-green-400' : status === 'busy' ? 'h-2 w-2 rounded-full bg-amber-300' : 'h-2 w-2 rounded-full bg-red-400';
  const statusLabel = status === 'online'
    ? (isEnglish ? 'Online' : 'Đang trực tuyến')
    : status === 'busy'
      ? (isEnglish ? 'Working' : 'Đang xử lý')
      : (isEnglish ? 'Unavailable' : 'Tạm gián đoạn');

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="maya-chat-title" className={'fixed bottom-16 right-3 z-[100] flex h-[min(540px,calc(100vh-5.5rem))] w-[min(380px,calc(100vw-1.5rem))] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl sm:bottom-20 sm:right-6'}>
      <header className={'flex items-center justify-between bg-gradient-to-r from-slate-900 to-blue-950 px-4 py-3 text-white'}>
        <div>
          <p id="maya-chat-title" className={'text-base font-semibold leading-tight'}>Mái Đỏ · Maian Homes</p>
          <p className={'flex items-center gap-1.5 text-[11px] text-blue-200'}><span className={dotClass} />{statusLabel}{language ? ` · ${language.toUpperCase()}` : ''}</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={resetChat} aria-label={isEnglish ? 'Start over' : 'Bắt đầu lại'} title={isEnglish ? 'Start over' : 'Bắt đầu lại'} className={'rounded-lg p-1.5 hover:bg-white/10 text-white/80 hover:text-white transition-colors'}><RotateCcw size={15} /></button>
          <button onClick={closeChat} aria-label={isEnglish ? 'Close chat' : 'Đóng chat'} className={'rounded-lg p-1.5 hover:bg-white/10 text-white/80 hover:text-white transition-colors'}><X size={18} /></button>
        </div>
      </header>

      {/* Main Messages Container */}
      <div aria-live="polite" className={'flex-1 space-y-3 overflow-y-auto bg-slate-50 p-3.5 relative'}>
        {messages.map((message, index) => (
          <div key={index} className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div className={message.role === 'user' ? 'max-w-[85%] whitespace-pre-wrap rounded-xl bg-blue-600 px-3 py-2 text-xs sm:text-sm text-white shadow-xs' : 'max-w-[85%] whitespace-pre-wrap rounded-xl border bg-white px-3 py-2 text-xs sm:text-sm text-slate-800 shadow-xs'}>{message.content}</div>
          </div>
        ))}

        {/* Quick prompt chips right after greeting */}
        {messages.length <= 1 && !loading && (
          <div className="pt-1 pb-1 space-y-1.5">
            <p className="text-[11px] font-medium text-slate-500">
              {isEnglish ? 'Quick options:' : 'Gợi ý nhanh:'}
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => { setShowLeadForm(true); setLeadError(null); }}
                className="inline-flex items-center gap-1 rounded-full border border-blue-300 bg-blue-50 px-2.5 py-1 text-[11px] font-semibold text-blue-700 hover:bg-blue-100 transition-colors shadow-2xs"
              >
                <Sparkles size={12} className="text-blue-600" />
                {isEnglish ? 'Request Consultation & Price' : 'Nhận tư vấn & Báo giá'}
              </button>
              <button
                type="button"
                onClick={() => sendMessageText(isEnglish ? 'What projects are currently available?' : 'Dự án nào đang mở bán?')}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors"
              >
                {isEnglish ? 'Available projects' : 'Dự án đang mở bán'}
              </button>
              <button
                type="button"
                onClick={() => sendMessageText(isEnglish ? 'How does the consultation process work?' : 'Quy trình tư vấn của Maian Homes?')}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors"
              >
                {isEnglish ? 'Consultation process' : 'Quy trình tư vấn'}
              </button>
              <button
                type="button"
                onClick={() => sendMessageText(isEnglish ? 'What are the latest market news and insights?' : 'Tin tức & Thị trường mới nhất')}
                className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-700 hover:border-slate-300 hover:bg-slate-50 transition-colors"
              >
                {isEnglish ? 'Market news' : 'Tin tức thị trường'}
              </button>
            </div>
          </div>
        )}

        {/* Smart contextual lead CTA chip when high-intent query was detected */}
        {suggestedAction && !leadSubmitted && !showLeadForm && (
          <div className="flex justify-start">
            <button
              type="button"
              onClick={() => {
                if (suggestedAction.note) setLeadNote(suggestedAction.note);
                setShowLeadForm(true);
                setLeadError(null);
              }}
              className="inline-flex items-center gap-1.5 rounded-full border border-blue-400 bg-gradient-to-r from-blue-50 to-indigo-50 px-3 py-1.5 text-xs font-semibold text-blue-800 hover:from-blue-100 hover:to-indigo-100 transition-all shadow-xs"
            >
              <Sparkles size={13} className="text-blue-600 animate-pulse shrink-0" />
              <span>{suggestedAction.label}</span>
              <span className="text-[10px] text-blue-500 font-bold shrink-0">→</span>
            </button>
          </div>
        )}

        {/* Contextual proposal card during ongoing chat */}
        {messages.length >= 2 && !leadSubmitted && !showLeadForm && !suggestedAction && (
          <div className="rounded-xl border border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 p-2.5 text-xs text-slate-800 shadow-2xs">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-blue-950 flex items-center gap-1.5">
                  <Sparkles size={13} className="text-blue-600 shrink-0" />
                  {isEnglish ? 'Need detailed price list or private advice?' : 'Cần bảng giá chi tiết hoặc tư vấn riêng?'}
                </p>
                <p className="text-[11px] text-slate-600 mt-0.5">
                  {isEnglish ? 'Leave your contact info and our team will call back via Zalo/Hotline.' : 'Để lại thông tin để chuyên viên Maian Homes hỗ trợ nhanh qua Zalo/Điện thoại.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => { setShowLeadForm(true); setLeadError(null); }}
                className="shrink-0 rounded-lg bg-blue-600 px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700 transition-colors shadow-xs"
              >
                {isEnglish ? 'Leave phone' : 'Để lại SĐT'}
              </button>
            </div>
          </div>
        )}

        {loading && <div className={'flex items-center gap-2 text-sm text-slate-500'}><Loader2 size={16} className={'animate-spin'} />{isEnglish ? 'Mái Đỏ is working...' : 'Mái Đỏ đang xử lý...'}</div>}

        {sources.length > 0 && (
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-xs text-slate-700">
            <p className="mb-2 font-semibold">{isEnglish ? 'Official sources' : 'Nguồn chính thức'}</p>
            <ul className="space-y-1.5">
              {sources.map(source => (
                <li key={source.url} className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white text-slate-600 border border-slate-200 shrink-0">
                    {source.type === 'article' ? (isEnglish ? 'Article' : 'Tin tức') : source.type === 'project' ? (isEnglish ? 'Project' : 'Dự án') : (isEnglish ? 'Company' : 'Công ty')}
                  </span>
                  <a className="text-blue-700 underline hover:text-blue-900 truncate" href={source.url}>{source.title}</a>
                </li>
              ))}
            </ul>
          </div>
        )}
        <div ref={endRef} />

        {/* Inline Lead Capture Form Modal / Overlay */}
        {showLeadForm && (
          <div className="absolute inset-x-0 bottom-0 top-0 z-20 flex flex-col bg-white p-3.5 shadow-2xl animate-in fade-in slide-in-from-bottom-3 duration-200">
            <div className="flex items-center justify-between pb-2.5 border-b">
              <div className="flex items-center gap-2">
                <div className="rounded-lg bg-blue-100 p-1.5 text-blue-700">
                  <PhoneCall size={16} />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-900 leading-tight">
                    {isEnglish ? 'Receive Expert Consultation' : 'Nhận tư vấn từ chuyên viên'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    {isEnglish ? 'Free consultation · Fast callback via Zalo' : 'Tư vấn miễn phí · Phản hồi nhanh qua Zalo / Hotline'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowLeadForm(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                aria-label="Đóng form tư vấn"
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleLeadSubmit} className="flex-1 flex flex-col justify-between pt-2.5 space-y-2.5">
              <div className="space-y-2.5 overflow-y-auto pr-1">
                {leadError && (
                  <div className="flex items-center gap-2 rounded-lg bg-red-50 p-2 text-xs text-red-700 border border-red-200">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>{leadError}</span>
                  </div>
                )}

                <div>
                  <label htmlFor="lead-name" className="block text-xs font-semibold text-slate-700 mb-1">
                    {isEnglish ? 'Your Name' : 'Họ và tên'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="lead-name"
                    type="text"
                    required
                    maxLength={100}
                    autoComplete="off"
                    value={leadName}
                    onChange={(e) => setLeadName(e.target.value)}
                    placeholder={isEnglish ? 'e.g. John Doe' : 'Ví dụ: Nguyễn Văn A'}
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-black outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="lead-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                    {isEnglish ? 'Phone Number (Zalo)' : 'Số điện thoại (Zalo)'} <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="lead-phone"
                    type="tel"
                    required
                    maxLength={15}
                    autoComplete="off"
                    value={leadPhone}
                    onChange={(e) => setLeadPhone(e.target.value)}
                    placeholder={isEnglish ? 'e.g. 0969 10 50 59' : 'Ví dụ: 0969 10 50 59'}
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-black outline-none focus:border-blue-500"
                  />
                </div>

                <div>
                  <label htmlFor="lead-note" className="block text-xs font-semibold text-slate-700 mb-1">
                    {isEnglish ? 'Project or Requirement' : 'Dự án / Nhu cầu quan tâm'}
                  </label>
                  <input
                    id="lead-note"
                    type="text"
                    maxLength={200}
                    autoComplete="off"
                    value={leadNote}
                    onChange={(e) => setLeadNote(e.target.value)}
                    placeholder={isEnglish ? 'e.g. Price quote, schedule a visit...' : 'Ví dụ: Báo giá, xem nhà mẫu, ký gửi...'}
                    className="w-full rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-black outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="pt-2 border-t mt-auto">
                <button
                  type="submit"
                  disabled={leadSubmitting || !leadName.trim() || !leadPhone.trim()}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2 text-xs sm:text-sm font-semibold text-white shadow-md hover:bg-blue-700 disabled:bg-slate-300 transition-colors"
                >
                  {leadSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      {isEnglish ? 'Submitting...' : 'Đang gửi thông tin...'}
                    </>
                  ) : (
                    <>
                      <Send size={15} />
                      {isEnglish ? 'Send Consultation Request' : 'Gửi yêu cầu tư vấn'}
                    </>
                  )}
                </button>
                <p className="text-[10px] text-center text-slate-400 mt-1.5">
                  {isEnglish ? 'Information is securely protected under Maian Homes policy.' : 'Thông tin được bảo mật theo chính sách quyền riêng tư của Maian Homes.'}
                </p>
              </div>
            </form>
          </div>
        )}
      </div>

      <form onSubmit={send} autoComplete="off" className={'flex gap-1.5 border-t p-2.5'}>
        <label htmlFor="maya-message" className="sr-only">{isEnglish ? 'Message Mái Đỏ' : 'Tin nhắn cho Mái Đỏ'}</label>
        <input
          ref={inputRef}
          id="maya-message"
          name="maya_chat_message"
          type="text"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          data-lpignore="true"
          data-form-type="other"
          maxLength={2000}
          value={input}
          onChange={(event) => setInput(event.target.value)}
          disabled={loading}
          placeholder={status === 'unavailable' ? (isEnglish ? 'Type to try connecting again' : 'Nhập tin nhắn để thử kết nối lại') : (isEnglish ? 'Type a message...' : 'Nhập tin nhắn...')}
          className={'min-w-0 flex-1 rounded-xl border px-3 py-2 text-xs sm:text-sm text-black outline-none focus:border-blue-500 disabled:bg-slate-100'}
        />
        <button disabled={!input.trim() || loading} className={'rounded-xl bg-blue-600 p-2 text-white disabled:bg-slate-300'} aria-label={isEnglish ? 'Send' : 'Gửi'}><Send size={16} /></button>
        {phone && <a href={`tel:${phone}`} aria-label={isEnglish ? 'Call hotline' : 'Gọi hotline'} title={`Hotline ${phone}`} className="rounded-xl bg-emerald-600 p-2 text-white"><Phone size={16} /></a>}
      </form>
    </div>
  );
}
