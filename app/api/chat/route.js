export async function POST(request) {
  const { messages } = await request.json();
  const GROQ_API_KEY = process.env.GROQ_API_KEY;
  const SERPER_API_KEY = process.env.SERPER_API_KEY;

  if (!GROQ_API_KEY) {
    return Response.json(
      { error: "API key not configured. Add GROQ_API_KEY in Vercel environment variables." },
      { status: 500 }
    );
  }

  const systemPrompt = `You are FurShop, a pet product assistant. You always respond in valid JSON with this exact structure:

{
  "intro": "A brief 1-sentence intro",
  "products": [
    {
      "name": "Product name",
      "brand": "Brand name",
      "price": "€XX",
      "description": "1-2 sentences about the product.",
      "pet_type": "dog"
    }
  ],
  "tip": "A brief tip or follow-up (optional, can be empty string)"
}

Rules:
- Always include 3-5 products when the user asks for recommendations
- pet_type must be exactly "dog" or "cat"
- If the user is vague, still suggest products — do not ask clarifying questions
- Never output anything outside the JSON object
- Respond ONLY with the JSON, no markdown, no code fences`;

  const groqMessages = [
    { role: "system", content: systemPrompt },
    ...messages.map((msg) => ({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content,
    })),
  ];

  try {
    const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GROQ_API_KEY}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: groqMessages,
        temperature: 0.7,
        max_tokens: 2048,
        response_format: { type: "json_object" },
      }),
    });

    const groqData = await groqResponse.json();

    if (groqData.error) {
      console.error("Groq API error:", JSON.stringify(groqData.error));
      return Response.json({ error: groqData.error.message }, { status: 500 });
    }

    let text = "";
    const raw = groqData.choices?.[0]?.message?.content || "{}";
    try {
      const parsed = JSON.parse(raw);
      const intro = parsed.intro || "";
      const tip = parsed.tip || "";
      const products = parsed.products || [];
      const blocks = products.map(p =>
        `ITEM_START\nNAME: ${p.name}\nBRAND: ${p.brand}\nPRICE: ${p.price}\nDESCRIPTION: ${p.description}\nPET_TYPE: ${p.pet_type || "dog"}\nITEM_END`
      ).join("\n\n");
      text = [intro, blocks, tip].filter(Boolean).join("\n\n");
    } catch (e) {
      text = raw;
    }

    if (SERPER_API_KEY) {
      const itemRegex = new RegExp("ITEM_START\\s+NAME:\\s*(.+?)\\s*\\nBRAND:\\s*(.+?)\\s*\\nPRICE:\\s*(.+?)\\s*\\nDESCRIPTION:\\s*([\\s\\S]+?)\\nPET_TYPE:\\s*(.+?)\\s*\\nITEM_END", "g");
      const matches = [...text.matchAll(itemRegex)];

      console.log(`Found ${matches.length} items to enrich`);

      const enriched = await Promise.all(
        matches.map(async (m) => {
          const name = m[1].trim();
          const brand = m[2].trim();
          const price = m[3].trim();
          const petType = m[5].trim().toLowerCase();
          const query = `${brand} ${name} ${petType} buy online`;

          try {
            const serperRes = await fetch("https://google.serper.dev/shopping", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "X-API-KEY": SERPER_API_KEY,
              },
              body: JSON.stringify({ q: query, num: 1 }),
            });

            const serperData = await serperRes.json();
            const result = serperData.shopping?.[0];

            console.log(`Serper result for "${query}":`, result?.link, result?.imageUrl);

            return {
              original: m[0],
              name, brand,
              url: result?.link || "https://www.google.com/search?q=" + encodeURIComponent(query),
              imageUrl: result?.imageUrl || "",
              price: result?.price || price,
            };
          } catch (e) {
            console.error(`Serper error for "${query}":`, e.message);
            return {
              original: m[0],
              name, brand,
              url: "https://www.google.com/search?q=" + encodeURIComponent(query),
              imageUrl: "",
              price,
            };
          }
        })
      );

      enriched.forEach(({ original, url, imageUrl, price }) => {
        const enrichedBlock = original
          .replace(/PRICE:\s*.+/, `PRICE: ${price}`)
          .replace("ITEM_END", `URL: ${url}\nIMAGE: ${imageUrl}\nITEM_END`);
        text = text.replace(original, enrichedBlock);
      });
    }

    return Response.json({ text });

  } catch (error) {
    console.error("Fetch error:", error.message);
    return Response.json({ error: "Connection issue — please try again." }, { status: 500 });
  }
}
