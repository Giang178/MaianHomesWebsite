// src/components/layout/MayaAssistant.tsx
'use client';

import {useRef, useState} from 'react';
import FloatingContactWidget from '@/components/ui/contact/FloatingContactWidget';
import ChatWindow from '@/components/ui/chat/ChatWindow';
import ZaloOAChatWidget, {type ZaloOAChatWidgetHandle} from '@/components/ui/contact/ZaloOAChatWidget';
import {usePublicContactSettings} from '@/features/contact/usePublicContactSettings';

export default function MayaAssistant() {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isZaloChatOpen, setIsZaloChatOpen] = useState(false);
  const zaloChatRef = useRef<ZaloOAChatWidgetHandle>(null);
  const {contact} = usePublicContactSettings();

  return (
    <>
      <FloatingContactWidget
        contact={contact}
        isVisible={!isChatOpen && !isZaloChatOpen}
        isZaloChatOpen={isZaloChatOpen}
        onOpenChat={() => setIsChatOpen(true)}
        onOpenZaloChat={() => zaloChatRef.current?.open()}
        onPositionZaloLauncher={(x, y) => zaloChatRef.current?.positionLauncher?.(x, y)}
        onResetZaloLauncher={() => zaloChatRef.current?.resetLauncher?.()}
      />
      <ZaloOAChatWidget
        ref={zaloChatRef}
        oaId={contact.zalo_oa_id}
        fallbackUrl={contact.zalo_url}
        onOpenChange={setIsZaloChatOpen}
      />
      <ChatWindow isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} phone={contact.phone} />
    </>
  );
}
