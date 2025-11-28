import { GoogleGenAI, Modality, Chat } from "@google/genai";
import { decode, decodeAudioData } from "./audioUtils";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export interface TTSResponse {
  audioUrl?: string;
  error?: string;
}

export const generateTTS = async (text: string): Promise<TTSResponse> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: "Kore" }
          }
        }
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    
    if (!base64Audio) {
        throw new Error("No audio data returned");
    }

    const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({sampleRate: 24000});
    const audioBuffer = await decodeAudioData(
        decode(base64Audio),
        outputAudioContext,
        24000,
        1
    );

    const wavBlob = audioBufferToWav(audioBuffer);
    const audioUrl = URL.createObjectURL(wavBlob);

    return { audioUrl };
  } catch (error: any) {
    console.error("Gemini TTS Error:", error);
    return { error: error.message || "Failed to generate speech" };
  }
};

export const generateStudyGuide = async (resourceContent: string): Promise<{ text: string; sources: any[] }> => {
  try {
    const systemPrompt = "You are an expert Clinical Medicine tutor. Analyze the provided resource (e.g., objectives or past papers) and generate a comprehensive, highly relevant study guide in Markdown format. The guide should include a brief introduction, 3-5 key concepts derived from the content, and 3 high-yield study questions based on the material. Use clear headings and lists. Keep the total output concise, professional, and directly useful for medical students.";
    
    const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: `Generate a high-yield study guide based on the following resource content:\n---\n${resourceContent}\n---`,
        config: {
            systemInstruction: systemPrompt,
            tools: [{ googleSearch: {} }],
        }
    });

    const text = response.text || "No content generated.";
    const sources = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];

    return { text, sources };

  } catch (error: any) {
      console.error("Gemini Study Guide Error:", error);
      return { text: "Error generating study guide. Please try again.", sources: [] };
  }
}

export const transcribeAudio = async (base64Audio: string, mimeType: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Audio
            }
          },
          {
            text: "Transcribe the following audio exactly as spoken. Do not add any commentary."
          }
        ]
      }
    });
    return response.text || "";
  } catch (error) {
    console.error("Transcription Error:", error);
    throw error;
  }
};

export const createChatSession = (): Chat => {
  return ai.chats.create({
    model: 'gemini-3-pro-preview',
    config: {
      systemInstruction: "You are a friendly, expert Clinical Medicine Tutor. You help medical students understand complex concepts, differential diagnoses, and treatment protocols. Your answers should be accurate, concise, and educational. When appropriate, use bullet points or bold text to structure your answer. If a query is not related to medicine or health, politely steer the conversation back to clinical topics.",
    }
  });
};

// Helper to convert AudioBuffer to WAV Blob
function audioBufferToWav(buffer: AudioBuffer): Blob {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const bufferArr = new ArrayBuffer(length);
    const view = new DataView(bufferArr);
    const channels = [];
    let i, sample;
    let offset = 0;
    let pos = 0;
  
    // write WAVE header
    setUint32(0x46464952); // "RIFF"
    setUint32(length - 8); // file length - 8
    setUint32(0x45564157); // "WAVE"
  
    setUint32(0x20746d66); // "fmt " chunk
    setUint32(16); // length = 16
    setUint16(1); // PCM (uncompressed)
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan); // avg. bytes/sec
    setUint16(numOfChan * 2); // block-align
    setUint16(16); // 16-bit (hardcoded in this example)
  
    setUint32(0x61746164); // "data" - chunk
    setUint32(length - pos - 44); // chunk length
  
    // write interleaved data
    for(i = 0; i < buffer.numberOfChannels; i++)
      channels.push(buffer.getChannelData(i));
  
    while(pos < buffer.length) {
      for(i = 0; i < numOfChan; i++) { 
        sample = Math.max(-1, Math.min(1, channels[i][pos])); 
        sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767)|0; 
        view.setInt16(44 + offset, sample, true); 
        offset += 2;
      }
      pos++;
    }
  
    return new Blob([bufferArr], {type: "audio/wav"});
  
    function setUint16(data: any) {
      view.setUint16(pos, data, true);
      pos += 2;
    }
  
    function setUint32(data: any) {
      view.setUint32(pos, data, true);
      pos += 4;
    }
  }