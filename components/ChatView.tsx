import React, { useState, useRef, useEffect } from 'react';
import { createChatSession, transcribeAudio } from '../services/gemini';
import { GenerateContentResponse, Chat } from "@google/genai";
import { Send, Bot, User as UserIcon, Loader2, Sparkles, AlertCircle, Mic, Square } from 'lucide-react';
import { User } from '../services/firebase';

interface ChatViewProps {
  user: User | null;
}

interface Message {
  id: string;
  role: 'user' | 'model';
  text: string;
  isStreaming?: boolean;
}

export const ChatView: React.FC<ChatViewProps> = ({ user }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'model',
      text: "Hello! I'm your AI Clinical Tutor. How can I help you with your medical studies today?"
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  
  const chatSessionRef = useRef<Chat | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  useEffect(() => {
    chatSessionRef.current = createChatSession();
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || !chatSessionRef.current) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      text: input
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const aiMessageId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, {
        id: aiMessageId,
        role: 'model',
        text: '',
        isStreaming: true
      }]);

      const result = await chatSessionRef.current.sendMessageStream({ message: userMessage.text });
      
      let fullText = '';
      for await (const chunk of result) {
        const c = chunk as GenerateContentResponse;
        const text = c.text || '';
        fullText += text;
        
        setMessages(prev => prev.map(msg => 
          msg.id === aiMessageId 
            ? { ...msg, text: fullText } 
            : msg
        ));
      }

      setMessages(prev => prev.map(msg => 
        msg.id === aiMessageId 
          ? { ...msg, isStreaming: false } 
          : msg
      ));

    } catch (error) {
      console.error("Chat Error:", error);
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: 'model',
        text: "I'm sorry, I encountered an error. Please try asking again."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const startRecording = async () => {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mediaRecorder = new MediaRecorder(stream);
        mediaRecorderRef.current = mediaRecorder;
        chunksRef.current = [];

        mediaRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        mediaRecorder.onstop = async () => {
            const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
            setIsTranscribing(true);
            try {
                const reader = new FileReader();
                reader.readAsDataURL(blob);
                reader.onloadend = async () => {
                    const base64String = reader.result as string;
                    // Remove data url prefix "data:audio/webm;base64,"
                    const base64 = base64String.split(',')[1];
                    const text = await transcribeAudio(base64, 'audio/webm');
                    if (text) {
                        setInput(prev => (prev ? prev + ' ' + text : text).trim());
                    }
                    setIsTranscribing(false);
                }
            } catch (err) {
                console.error("Transcription error", err);
                setIsTranscribing(false);
            }
            // Stop all tracks to release microphone
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorder.start();
        setIsRecording(true);
    } catch (err) {
        console.error("Error accessing microphone:", err);
        alert("Could not access microphone. Please ensure permissions are granted.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop();
        setIsRecording(false);
    }
  };

  const renderMarkdown = (text: string) => {
    const html = text
      .replace(/^### (.*$)/gim, '<h3 class="font-bold text-lg mt-4 mb-2 text-slate-800">$1</h3>')
      .replace(/^## (.*$)/gim, '<h2 class="font-bold text-xl mt-5 mb-3 text-slate-800">$1</h2>')
      .replace(/\*\*(.*?)\*\*/gim, '<strong class="text-slate-900">$1</strong>')
      .replace(/^\* (.*$)/gim, '<li class="ml-4 list-disc marker:text-ai/50">$1</li>')
      .replace(/\n/gim, '<br />');
    
    return <div dangerouslySetInnerHTML={{ __html: html }} />;
  };

  return (
    <div className="flex flex-col h-[600px] md:h-[calc(100vh-140px)] bg-white rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden">
      {/* Header */}
      <div className="p-4 px-6 border-b border-slate-100 flex items-center justify-between bg-white z-10">
        <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-tr from-violet-500 to-fuchsia-500 text-white rounded-xl flex items-center justify-center mr-4 shadow-md shadow-violet-200">
                <Sparkles size={20} />
            </div>
            <div>
                <h2 className="text-lg font-bold text-slate-800">AI Tutor</h2>
                <div className="flex items-center text-xs text-slate-400 font-medium">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 mr-1.5"></span>
                    Gemini 3.0 Pro Active
                </div>
            </div>
        </div>
        {!user && (
           <div className="hidden sm:flex items-center text-xs font-semibold text-amber-700 bg-amber-50 px-3 py-1.5 rounded-full border border-amber-100">
             <AlertCircle size={14} className="mr-1.5" />
             Discussions not saved
           </div>
        )}
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 bg-slate-50">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div className={`flex max-w-[90%] md:max-w-[75%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
              
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center mt-1 ${
                msg.role === 'user' 
                  ? 'bg-primary text-white ml-3 shadow-md shadow-emerald-200' 
                  : 'bg-white border border-slate-100 text-violet-500 mr-3 shadow-sm'
              }`}>
                {msg.role === 'user' ? <UserIcon size={16} /> : <Bot size={18} />}
              </div>

              <div className={`px-5 py-4 rounded-2xl shadow-sm leading-relaxed ${
                msg.role === 'user' 
                  ? 'bg-primary text-white rounded-tr-sm shadow-emerald-100' 
                  : 'bg-white border border-slate-100 text-slate-700 rounded-tl-sm'
              }`}>
                <div className={`prose prose-sm max-w-none ${msg.role === 'user' ? 'text-white prose-invert' : ''}`}>
                    {msg.role === 'model' ? renderMarkdown(msg.text) : msg.text}
                </div>
                {msg.isStreaming && (
                    <div className="flex items-center space-x-1 mt-2">
                        <div className="w-1.5 h-1.5 bg-ai/40 rounded-full animate-bounce delay-0"></div>
                        <div className="w-1.5 h-1.5 bg-ai/40 rounded-full animate-bounce delay-75"></div>
                        <div className="w-1.5 h-1.5 bg-ai/40 rounded-full animate-bounce delay-150"></div>
                    </div>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="p-4 sm:p-6 bg-white border-t border-slate-100">
        <form onSubmit={handleSubmit} className="relative flex items-center">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask a clinical question or request a summary..."
            className="w-full pl-5 pr-28 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-ai/20 focus:border-ai outline-none transition-all shadow-inner text-slate-700"
            disabled={isLoading || isRecording || isTranscribing}
          />
          <div className="absolute right-2 flex items-center gap-1">
             <button
                type="button"
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isLoading || isTranscribing}
                className={`p-2.5 rounded-xl transition-all duration-200 ${
                    isRecording 
                      ? 'bg-red-500 text-white animate-pulse shadow-md' 
                      : isTranscribing
                        ? 'bg-slate-100 text-slate-400'
                        : 'bg-transparent text-slate-400 hover:text-slate-600 hover:bg-slate-100'
                }`}
                title={isRecording ? "Stop Recording" : "Speak to Text"}
              >
                {isTranscribing ? <Loader2 size={20} className="animate-spin" /> : isRecording ? <Square size={20} fill="currentColor" /> : <Mic size={20} />}
              </button>
              <button
                type="submit"
                disabled={!input.trim() || isLoading || isRecording}
                className={`p-2.5 rounded-xl transition-all duration-200 ${
                  input.trim() && !isLoading && !isRecording
                    ? 'bg-ai text-white hover:bg-violet-600 shadow-md hover:shadow-lg active:scale-95' 
                    : 'bg-transparent text-slate-300 cursor-not-allowed'
                }`}
              >
                {isLoading ? <Loader2 size={20} className="animate-spin text-ai" /> : <Send size={20} />}
              </button>
          </div>
        </form>
        <div className="text-center mt-3">
            <p className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">
                AI assistance may contain inaccuracies. Verify with clinical guidelines.
            </p>
        </div>
      </div>
    </div>
  );
};