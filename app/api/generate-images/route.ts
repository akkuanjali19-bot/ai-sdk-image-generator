import { NextRequest, NextResponse } from "next/server";

// ✅ Your Render backend URL
const BACKEND_URL = "https://image-backend-pbt7.onrender.com/generate";

export async function POST(req: NextRequest) {
  try {
    // Get data from frontend
    const { prompt, userEmail, plan } = await req.json();

    if (!prompt || !userEmail) {
      return NextResponse.json({ error: "Missing prompt or userEmail" }, { status: 400 });
    }

    // Call your Render backend
    const res = await fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        user_id: userEmail, // Google login ID
        plan: plan || "free" // default to free
      }),
    });

    const data = await res.json();

    if (data.error) {
      // Backend returned an error (daily limit or other)
      return NextResponse.json({ error: data.error }, { status: 403 });
    }

    // Return response to frontend
    return NextResponse.json({
      provider: "pollinations-backend",
      image: data.image,
      remaining: data.remaining,
      plan: data.plan,
    });

  } catch (error) {
    console.error("Error calling backend:", error);
    return NextResponse.json(
      { error: "Failed to generate image. Try again later." },
      { status: 500 }
    );
  }
}
