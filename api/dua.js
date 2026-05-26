export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { userNeed } = req.body;

    if (!userNeed || userNeed.trim() === "") {
      return res.status(400).json({ error: "اكتب حاجتك أولاً." });
    }

    const response = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.XAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "grok-4.3",
        max_tokens: 900,
        temperature: 0.75,
        messages: [
          {
            role: "system",
            content: `أنت مساعد متخصص في صياغة الأدعية باللغة العربية بأسلوب إيماني هادئ، واضح، مؤثر، وغير متكلف.

اكتب الدعاء مباشرة بدون مقدمة.
لا تخترع آيات أو أحاديث.
لا تنسب شيئاً للنبي ﷺ إلا إذا كنت متأكداً.
اجعل الدعاء من 8 إلى 12 فقرة.
اجعل كل فقرة من سطرين إلى ثلاثة أسطر.
وسّع الدعاء بالتضرع والثناء على الله وطلب الخير في الدنيا والآخرة.
كل فقرة تبدأ بـ "اللهم" أو "ربنا" أو "يا رب".
اختم بـ "آمين".`
          },
          {
            role: "user",
            content: `أريد دعاءً مناسباً لهذه الحاجة: ${userNeed}`
          }
        ]
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || JSON.stringify(data)
      });
    }

    const dua = data?.choices?.[0]?.message?.content;

    if (!dua) {
      return res.status(500).json({ error: "لم يرجع الذكاء الاصطناعي رداً." });
    }

    return res.status(200).json({ dua });

  } catch (error) {
    return res.status(500).json({ error: "حدث خطأ في السيرفر." });
  }
}
