import express from 'express';
import multer from 'multer';
import cors from 'cors';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';

dotenv.config();

const app = express();
const upload = multer({ storage: multer.memoryStorage() });

const apiKey = process.env.GEMINI_API_KEY ? process.env.GEMINI_API_KEY.trim() : '';
const ai = new GoogleGenAI({ apiKey: apiKey });

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

app.post('/api/analyze', upload.single('file'), async (req, res) => {
    console.log('----------------------------------------------------');
    console.log('📩 ได้รับข้อมูลจากหน้าเว็บ กำลังวิเคราะห์...');

    try {
        const { kind, message, sender, amount } = req.body;
        const file = req.file;

        const now = new Date();
        const currentYearCE = now.getFullYear();
        const currentYearBE = currentYearCE + 543;
        const currentDateStr = now.toLocaleDateString('th-TH', { 
            year: 'numeric', month: 'long', day: 'numeric' 
        });

        const promptText = `
คุณคือระบบ AI ผู้เชี่ยวชาญด้านการตรวจพิสูจน์หลักฐานดิจิทัลและสลิปการโอนเงิน (ScamShield AI)
หน้าที่ของคุณคือวิเคราะห์รูปภาพหรือข้อความอย่างละเอียด โดยอ่านรายละเอียดจริงจากภาพ

บริบทเวลาปัจจุบัน:
- วันที่ปัจจุบันคือ: ${currentDateStr} (พ.ศ. ${currentYearBE} / ค.ศ. ${currentYearCE})
- สลิปหรือเอกสารที่มีปี พ.ศ. ${currentYearBE} หรือ ค.ศ. ${currentYearCE} คือเวลาปัจจุบัน ไม่ใช่วันที่ล่วงหน้า

ข้อมูลที่ได้รับจากแบบฟอร์ม:
- ประเภทข้อมูล: ${kind || 'ไม่ระบุ'}
- ข้อความเพิ่มเติม: ${message || 'ไม่มี'}
- ชื่อผู้ส่ง: ${sender || 'ไม่มี'}
- จำนวนเงินที่ระบุ: ${amount ? amount + ' บาท' : 'ไม่มี'}

ภารกิจของคุณ:
1. หากมีไฟล์ภาพ (เช่น สลิปการโอนเงินหรือภาพแชต): 
   - ให้อ่านและถอดข้อความสำคัญที่ปรากฏในภาพ (ชื่อธนาคาร, วันที่/เวลา, ผู้โอน, ผู้รับ, ยอดเงิน, รหัสอ้างอิง/QR Code)
   - ตรวจสอบความสม่ำเสมอของตัวอักษร ฟอนต์ การจัดวาง ตำแหน่ง และความคมชัดของภาพ
2. ประเมินความเสี่ยงและคำนวณคะแนนตามจริง (0 ถึง 100):
   - ห้ามตอบเลข 10 ซ้ำซาก ให้คำนวณตัวเลขตามน้ำหนักความน่าสงสัยจริง
   - หากเป็นสลิปจริงที่สมบูรณ์ ชัดเจน ไม่มีรอยตัดต่อ ให้คะแนนต่ำตามความเหมาะสม (เช่น 2, 4, 7 หรือ 0)
   - หากเป็นข้อความทั่วไป ไม่มีการหลอกลวง ให้คะแนนต่ำ
   - หากมีจุดสงสัย เช่น ยอดเงินไม่ตรง หรือรูปแบบน่าสงสัย ให้คำนวณคะแนนเพิ่มตามความรุนแรง
   - หากพบการขอ OTP, ลิงก์ฟิชชิ่ง, หรือพบการตัดต่อตัวเลข/ฟอนต์ชัดเจน ให้คะแนนสูง (70 - 95)

ตอบกลับเป็น JSON รูปแบบนี้เท่านั้น (ห้ามมี Markdown หรือ \`\`\`):
{
  "score": ตัวเลขคะแนนความเสี่ยงตามที่ประเมินจริง (ตัวเลขจำนวนเต็ม 0-100),
  "level": "ต่ำ" หรือ "ปานกลาง" หรือ "สูง",
  "suspicious_points": [
    "ระบุรายละเอียดที่ตรวจพบจริงจากภาพหรือข้อความ (เช่น ยอดเงินที่อ่านได้, วันที่ในสลิป, หรือไม่พบร่องรอยการแก้ไขภาพ)"
  ],
  "reasons": [
    "เหตุผลประกอบการประเมินความเสี่ยง"
  ],
  "advice": [
    "คำแนะนำการตรวจสอบเพิ่มเติมสำหรับผู้ใช้"
  ]
}
        `.trim();

        const contents = [];
        contents.push({ text: promptText });

        if (file) {
            console.log(`📁 ไฟล์แนบ: ${file.originalname} (${file.size} bytes)`);
            contents.push({
                inlineData: {
                    mimeType: file.mimetype,
                    data: file.buffer.toString('base64')
                }
            });
        }

        const candidateModels = ['gemini-3.5-flash-lite', 'gemini-3.8-flash'];
        let response = null;
        let lastError = null;

        for (const model of candidateModels) {
            for (let attempt = 1; attempt <= 3; attempt++) {
                try {
                    console.log(`🤖 กำลังส่งให้โมเดล: ${model} (รอบที่ ${attempt})...`);
                    response = await ai.models.generateContent({
                        model: model,
                        contents: contents,
                        config: {
                            responseMimeType: 'application/json'
                        }
                    });
                    if (response) break;
                } catch (err) {
                    lastError = err;
                    await sleep(1500);
                }
            }
            if (response) break;
        }

        if (!response) {
            throw lastError || new Error('ขณะนี้ระบบประมวลผลหนาแน่น กรุณาลองใหม่อีกครั้ง');
        }

        let responseText = response.text.trim();
        if (responseText.startsWith('```json')) {
            responseText = responseText.replace(/^```json/, '').replace(/```$/, '').trim();
        } else if (responseText.startsWith('```')) {
            responseText = responseText.replace(/^```/, '').replace(/```$/, '').trim();
        }

        const resultJson = JSON.parse(responseText);

        // คำนวณระดับความเสี่ยงให้ตรงกับคะแนนจริงเสมอ
        if (resultJson.score >= 60) {
            resultJson.level = 'สูง';
        } else if (resultJson.score >= 30) {
            resultJson.level = 'ปานกลาง';
        } else {
            resultJson.level = 'ต่ำ';
        }

        console.log('🎉 ประมวลผลสำเร็จ! คะแนนที่ประเมินได้จริง:', resultJson.score);
        res.json(resultJson);

    } catch (error) {
        console.error('❌ AI Error รายละเอียด:', error.message);
        res.status(500).json({ error: error.message || 'เกิดข้อผิดพลาดในการประมวลผล' });
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`🚀 Server พร้อมทำงานที่ http://localhost:${PORT}`);
});