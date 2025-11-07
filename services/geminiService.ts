import { GoogleGenAI } from "@google/genai";

async function fileToGenerativePart(file: File) {
  const base64EncodedDataPromise = new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        // The result includes the data URL prefix (e.g., "data:audio/mpeg;base64,"), 
        // which we need to remove to get just the base64 string.
        const base64String = reader.result.split(',')[1];
        resolve(base64String);
      } else {
        reject(new Error("Failed to read file as a data URL string."));
      }
    };
    reader.onerror = (error) => {
        reject(error);
    };
    reader.readAsDataURL(file);
  });
  
  const base64EncodedData = await base64EncodedDataPromise;
  
  return {
    inlineData: {
      data: base64EncodedData,
      mimeType: file.type,
    },
  };
}


const buildPrompt = (language: string) => {
  return `
Please transcribe the provided audio and generate a subtitle file in SRT format. Adhere strictly to the following rules:

1. **SRT Structure:**
    - Each entry must have a sequence number, a timestamp, and subtitle text.
    - Separate each entry with a single blank line.

2. **Sequence Number:**
    - Start with 1 and increment by 1 for each entry.

3. **Timestamp:**
    - Use the EXACT format: \`hh:mm:ss,xxx\` (e.g., 00:01:05,009).
    - The hours part (hh) is mandatory, even if it's 00.
    - Use \` --> \` to separate start and end times.

4. **Subtitle Text:**
    - **CRITICAL:** The text for each entry MUST be a single line.
    - Keep subtitle lines to a reasonable length for optimal readability.
    - Break longer sentences into multiple, sequential SRT entries at natural semantic pauses.
    - Remove all punctuation (commas, periods, question marks, etc.).
    - Remove filler words (e.g., um, ah, uh) and stutters.
    - The language of the subtitles must be ${language}.

5. **Timing:**
    - Each subtitle entry should be visible for 3 to 5 seconds. Adjust timing based on the spoken pace.
`;
};


export const generateSrtFromAudio = async (audioFile: File, language: string): Promise<string> => {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set.");
    }

    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const audioPart = await fileToGenerativePart(audioFile);
        const prompt = buildPrompt(language);

        const response = await ai.models.generateContent({
            model: "gemini-2.5-pro",
            contents: { parts: [ {text: prompt}, audioPart ] },
            config: {
                systemInstruction: "You are an expert AI for generating SRT subtitles from audio. Your output MUST be ONLY the raw SRT content in the requested language. Do not add any explanation or formatting like markdown code blocks.",
            }
        });
        
        return response.text.trim();

    } catch (error) {
        console.error("Error generating subtitles:", error);
        if (error instanceof Error) {
          return `An error occurred: ${error.message}`;
        }
        return "產生字幕時發生未知錯誤。";
    }
};