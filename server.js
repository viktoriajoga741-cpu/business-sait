import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
const __dirname = path.dirname(fileURLToPath(import.meta.url));
app.use(express.json({ limit: "1mb" }));
app.use(express.static(__dirname));

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, aiConfigured: Boolean(process.env.GEMINI_API_KEY) });
});

app.post("/api/generate-creative", async (req, res) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(503).json({
      error: "AI не подключён: добавьте GEMINI_API_KEY в переменные окружения сервера."
    });
  }

  const { brand = "Ваш бренд", productInfo = "", style = "Динамичный премиум", platform = "Instagram Reels · 9:16" } = req.body ?? {};
  const prompt = `Создай рекламную концепцию короткого вертикального видео. Отвечай только валидным JSON без markdown, со свойствами: title (string), scenes (array строк, 4-6 сцен с длительностью и визуальным действием), caption (string), hashtags (array строк), cta (string).
Язык: русский. Бренд: ${String(brand).slice(0,120)}. Описание продукта: ${String(productInfo).slice(0,1500)}. Стиль: ${String(style).slice(0,100)}. Формат: ${String(platform).slice(0,100)}.
Не утверждай неподтверждённые свойства товара. Сделай идею конкретной, динамичной и пригодной для рекламного ролика.`;

  try {
    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json", temperature: 0.7 }
      })
    });
    const data = await response.json();
    if (!response.ok) {
      console.error("Gemini API error:", data?.error?.message || response.status);
      return res.status(502).json({ error: "Gemini API вернул ошибку. Проверьте ключ и доступность выбранной модели." });
    }
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("");
    if (!text) return res.status(502).json({ error: "ИИ не вернул текст. Попробуйте ещё раз." });
    let result;
    try { result = JSON.parse(text); } catch {
      return res.status(502).json({ error: "ИИ вернул ответ в неожиданном формате. Попробуйте ещё раз." });
    }
    return res.json(result);
  } catch (err) {
    console.error("Generation failed:", err?.message || err);
    return res.status(500).json({ error: "Не удалось связаться с ИИ. Попробуйте позже." });
  }
});

const port = Number(process.env.PORT || 3000);
app.listen(port, () => console.log(`AI Reel Studio server listening on port ${port}`));
