import { useState, useEffect, useRef, useCallback } from 'react';
import type { NPCInfo } from '../game/types';
import { streamNPCResponse } from '../services/MistralService';
import type { ConversationMessage } from '../services/MistralService';

interface Message {
  role: 'user' | 'npc';
  content: string;
}

interface Props {
  npc: NPCInfo;
  onClose: () => void;
}

const GREETING_TRIGGER = "[Le joueur s'approche de toi. Accueille-le chaleureusement en français, présente-toi et donne-lui envie de découvrir ta culture. 1-2 phrases seulement.]";

export function DialogueBox({ npc, onClose }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);

  const historyRef = useRef<ConversationMessage[]>([]);
  const mountedRef = useRef(true);
  const greetedRef = useRef(false); // guards against React StrictMode double-invoke
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const apiKey = import.meta.env.VITE_MISTRAL_API_KEY as string | undefined;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const streamResponse = useCallback(async () => {
    if (!mountedRef.current) return;
    console.log('apiKey:', apiKey);
    if (!apiKey) {
      setMessages((prev) => [
        ...prev,
        { role: 'npc', content: '⚠️ Clé API manquante : ajoute VITE_MISTRAL_API_KEY dans .env.local' },
      ]);
      return;
    }

    setIsStreaming(true);
    setMessages((prev) => [...prev, { role: 'npc', content: '' }]);

    let fullContent = '';
    try {
      for await (const token of streamNPCResponse(npc, historyRef.current, apiKey)) {
        if (!mountedRef.current) break;
        fullContent += token;
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'npc', content: fullContent };
          return copy;
        });
      }
      historyRef.current = [
        ...historyRef.current,
        { role: 'assistant', content: fullContent },
      ];
    } catch (err) {
      if (mountedRef.current) {
        setMessages((prev) => {
          const copy = [...prev];
          copy[copy.length - 1] = { role: 'npc', content: `Erreur : ${String(err)}` };
          return copy;
        });
      }
    } finally {
      if (mountedRef.current) setIsStreaming(false);
    }
  }, [npc, apiKey]);

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
    if (!msg || isStreaming) return;

    setInput('');
    setMessages((prev) => [...prev, { role: 'user', content: msg }]);
    historyRef.current = [...historyRef.current, { role: 'user', content: msg }];
    await streamResponse();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    if (e.key === 'Escape') onClose();
  };

  return (
    <div className="dialogue-overlay">
      <div className="dialogue-box" onKeyDown={handleKeyDown}>
        <div className="dialogue-header">
          <span className="dialogue-npc-name">{npc.name}</span>
          <button className="dialogue-close" onClick={onClose} aria-label="Fermer">
            ✕
          </button>
        </div>

        <div className="dialogue-messages">
          {messages.map((msg, i) => (
            <div key={i} className={`dialogue-msg dialogue-msg-${msg.role}`}>
              <span className="dialogue-msg-label">
                {msg.role === 'npc' ? npc.name : 'Toi'}
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
            placeholder="Écrire un message… (Entrée pour envoyer)"
            disabled={isStreaming}
          />
          <button onClick={handleSend} disabled={isStreaming || !input.trim()}>
            Envoyer
          </button>
        </div>
      </div>
    </div>
  );
}
