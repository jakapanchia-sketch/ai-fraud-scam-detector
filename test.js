import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

console.log("กำลังทดสอบด้วยคีย์:", process.env.GEMINI_API_KEY ? "พบ API Key แล้ว" : "❌ ไม่พบคีย์ใน .env");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function run() {
    try {
        const res = await ai.models.generateContent({
            model: 'gemini-2.0-flash',
            contents: 'ตอบคำว่า ใช้งานได้สั้นๆ',
        });
        console.log("✅ สำเร็จ! ผลตอบกลับ:", res.text);
    } catch (err) {
        console.error("❌ พังเพราะสาเหตุนี้ครับ:\n", err);
    }
}
run();