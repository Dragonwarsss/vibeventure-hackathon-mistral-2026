import { useState, useEffect, useRef, useCallback } from 'react';
import type { NPCInfo } from '../game/types';
import { streamNPCResponse } from '../services/MistralService';
import type { ConversationMessage } from '../services/MistralService';
import { TTSStreamer } from '../services/ElevenLabsService';

interface Message {
  role: 'user' | 'npc';
  content: string;
}

interface Props {
  npc: NPCInfo;
  /** Called with the number of messages the user typed (greeting excluded). */
  onClose: (userMessageCount: number) => void;
}

const GREETING_TRIGGER = "[The player approaches you. Warmly greet them in English, introduce yourself and make them want to discover your culture. 1-2 sentences only.]";

export function DialogueBox({ npc, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);

  // messagesRef stays current every render so Escape listener never has a stale count
  const messagesRef = useRef(messages);
  messagesRef.current = messages;

  const handleClose = useCallback(() => {
    const count = messagesRef.current.filter(m => m.role === 'user').length;
    onClose(count);
  }, [onClose]);

  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const historyRef = useRef<ConversationMessage[]>([]);
  const mountedRef = useRef(true);
  const greetedRef = useRef(false); // guards against React StrictMode double-invoke
  const isSendingRef = useRef(false); // synchronous lock to prevent double-send
  const ttsRef = useRef<TTSStreamer | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const apiKey = import.meta.env.VITE_MISTRAL_API_KEY as string | undefined;
  const elevenlabsKey = import.meta.env.VITE_ELEVENLABS_API_KEY as string | undefined;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const streamResponse = useCallback(async () => {
    if (!mountedRef.current) return;
    if (!apiKey) {
      setMessages((prev) => [
        ...prev,
        { role: 'npc', content: '⚠️ API key missing: add VITE_MISTRAL_API_KEY to .env.local' },
      ]);
      return;
    }

    // Stop any previous TTS and start fresh for this response
    ttsRef.current?.dispose();
    if (elevenlabsKey && npc.voiceId) {
      const tts = new TTSStreamer();
      tts.start(npc.voiceId, elevenlabsKey, npc.voiceSettings);
      ttsRef.current = tts;
    }

    setIsStreaming(true);
    setMessages((prev) => [...prev, { role: 'npc', content: '' }]);

    let fullContent = '';
    try {
      for await (const token of streamNPCResponse(npc, historyRef.current, apiKey)) {
        if (!mountedRef.current) break;
        fullContent += token;
        ttsRef.current?.sendText(token);
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'npc', content: fullContent };
          return copy;
        });
      }
      ttsRef.current?.flush();
      historyRef.current = [
        ...historyRef.current,
        { role: 'assistant', content: fullContent },
      ];
    } catch (err) {
      if (mountedRef.current) {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'npc', content: `Error: ${String(err)}` };
          return copy;
        });
      }
    } finally {
      if (mountedRef.current) setIsStreaming(false);
    }
  }, [npc, apiKey, elevenlabsKey]);

  // Fermeture globale sur Escape (indépendamment du focus)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleClose]);

  // Dispose TTS only on final unmount — separate from streamResponse effect
  // to avoid StrictMode intermediate cleanup killing the greeting stream
  useEffect(() => {
    return () => {
      ttsRef.current?.dispose();
      ttsRef.current = null;
    };
  }, []);

  // NPC greets automatically on open — greetedRef prevents double call in React StrictMode
  useEffect(() => {
    mountedRef.current = true;
    if (!greetedRef.current) {
      greetedRef.current = true;
      historyRef.current = [{ role: 'user', content: GREETING_TRIGGER }];
      streamResponse();
      setTimeout(() => inputRef.current?.focus(), 300);
    }
    return () => {
      mountedRef.current = false;
    };
  }, [streamResponse]);

  const handleSend = async () => {
    const msg = input.trim();
    if (!msg || isSendingRef.current) return;
    isSendingRef.current = true;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: msg }]);
    historyRef.current = [...historyRef.current, { role: 'user', content: msg }];
    try {
      await streamResponse();
    } finally {
      isSendingRef.current = false;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') handleClose();
  };

  return (
    <div className="dialogue-overlay">
      <div className="dialogue-box" onKeyDown={handleKeyDown}>
        <div className="dialogue-header">
          <span className="dialogue-npc-name">{npc.name}</span>
          <button className="dialogue-close" onClick={handleClose} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="dialogue-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`dialogue-msg dialogue-msg-${msg.role}`}>
              <span className="dialogue-msg-label">
                {msg.role === 'npc' ? npc.name : 'You'}
              </span>
              <p>
                {msg.content}
                {msg.role === 'npc' && i === messages.length - 1 && isStreaming && (
                  <span className="dialogue-cursor">▋</span>
                )}
              </p>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>

        <div className="dialogue-input-row">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message… (Enter to send)"
            disabled={isStreaming}
          />
          <button onClick={handleSend} disabled={isStreaming || !input.trim()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
