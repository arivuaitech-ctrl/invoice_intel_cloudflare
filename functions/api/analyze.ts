
import { GoogleGenAI } from "@google/genai";

interface Env {
    API_KEY: string;
}

export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const { image, mimeType } = await context.request.json() as { image: string, mimeType: string };

        if (!context.env.API_KEY) {
            return new Response(JSON.stringify({ error: "Server Error: API Key missing" }), { status: 500 });
        }

        const ai = new GoogleGenAI({ apiKey: context.env.API_KEY });
        const modelId = 'gemini-2.0-flash'; // Using the stable 2.0 Flash model

        // Schema for structured output
        const expenseSchema = {
            type: "OBJECT",
            properties: {
                vendorName: { type: "STRING", description: "Name of the merchant or vendor" },
                date: { type: "STRING", description: "Date of transaction in YYYY-MM-DD format" },
                amount: { type: "NUMBER", description: "Total amount paid (numeric)" },
                currency: { type: "STRING", description: "Currency code (e.g., MYR, USD, RM)" },
                category: {
                    type: "STRING",
                    enum: [
                        "Food & Dining", "Parking", "Toll", "Optical", "Dental",
                        "Clinic/Medical", "Mileage", "Airport Charges", "Transportation",
                        "Utility Bills", "Repair & Maintenance", "House Tax",
                        "Flights", "Accommodation", "Others"
                    ],
                    description: "Select the most appropriate category for tax filing/claims"
                },
                summary: { type: "STRING", description: "Brief description of the purchase" }
            },
            required: ["vendorName", "date", "amount", "category"]
        };

        const result = await ai.models.generateContent({
            model: modelId,
            contents: {
                parts: [
                    { inlineData: { mimeType: mimeType, data: image } },
                    { text: "Analyze the attached receipt or invoice. Extract the merchant name, date, total amount, currency, and categorize it based on the provided schema. If the date is not clear, use today's date." }
                ]
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: expenseSchema as any,
                temperature: 0.1
            }
        });

        const textOutput = result.text;
        if (!textOutput) throw new Error("No data returned from Gemini");

        return new Response(textOutput, {
            headers: { "Content-Type": "application/json" }
        });

    } catch (err: any) {
        console.error("Gemini Analysis Error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
