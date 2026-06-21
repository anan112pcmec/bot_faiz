import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: "isi sendiri" });

export default async function askAI(question, imageUrl) {
    try {
        let response;

        if (imageUrl) {
            // Jika ada foto, gunakan model multimodal
            response = await ai.models.generateContent({
                model: "gemini-2.5-multimodal",
                contents: [
                    { type: "image", imageUrl },
                    { type: "text", text: question },
                ],
            });
        } else {
            // Jika cuma teks, gunakan model text-only
            response = await ai.models.generateContent({
                model: "gemini-2.5-flash",
                contents: question,
            });
        }

        return response?.text || "Maaf, AI tidak bisa menjawab 😅";
    } catch (err) {
        console.error(err);
        return "Terjadi error saat menghubungi AI 😭";
    }
}
