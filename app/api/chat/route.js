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

  const systemPrompt = `You are FurShop, a pet product assistant. When a user asks for product recommendations, you MUST output each product using this EXACT block format — no exceptions, no variations:

ITEM_START
NAME: Royal Canin Labrador Adult
BRAND: Royal Canin
PRICE: €55
DESCRIPTION: Specially formulated for Labradors with high protein and joint support. Helps maintain healthy weight.
PET_TYPE: dog
ITEM_END

CRITICAL RULES — you MUST follow these exactly:
1. Every product MUST be wrapped in ITEM_START and ITEM_END
2. Every block MUST have all 5 fields: NAME, BRAND, PRICE, DESCRIPTION, PET_TYPE
3. NO blank lines between fields inside a block
4. PET_TYPE must be exactly "dog" or "cat" (lowercase only)
5. Always suggest 3-5 products
6. Write a 1-sentence intro before the blocks
7. Write a brief tip or question after the blocks
8. Do NOT include URLs or links
9. If the user just says hi or is vague, ask what their pet needs before suggesting products`;

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
      }),
    });

    const groqData = await groqResponse.json();

    if (groqData.error) {
      console.error("Groq API error:", JSON.stringify(groqData.error));
      return Response.json({ error: groqData.error.message }, { status: 500 });
    }

    let text = groqData.choices?.[0]?.message?.content || "";

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
