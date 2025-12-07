import { NextRequest, NextResponse } from "next/server";
import { ImageModel } from "ai";
import { openai } from "@ai-sdk/openai";
import { fireworks } from "@ai-sdk/fireworks";
import { replicate } from "@ai-sdk/replicate";
import { vertex } from "@ai-sdk/google-vertex/edge";
import { ProviderKey } from "@/lib/provider-config";
import { GenerateImageRequest } from "@/lib/api-types";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DEFAULT_IMAGE_SIZE = "1024x1024";
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DEFAULT_ASPECT_RATIO = "1:1";

// later
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const config = providerConfig[provider];
interface ProviderConfig {
  createImageModel: (modelId: string) => ImageModel;
  dimensionFormat: "size" | "aspectRatio";
}

const providerConfig: Record<ProviderKey, ProviderConfig> = {
  openai: { createImageModel: openai.image, dimensionFormat: "size" },
  fireworks: { createImageModel: fireworks.image, dimensionFormat: "aspectRatio" },
  replicate: { createImageModel: replicate.image, dimensionFormat: "size" },
  vertex: { createImageModel: vertex.image, dimensionFormat: "aspectRatio" },
};

const withTimeout = <T>(promise: Promise<T>, timeoutMillis: number): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), timeoutMillis)
    ),
  ]);
};

// ✅ Your Render backend URL
const BACKEND_URL = "https://image-backend-pbt7.onrender.com/generate";

export async function POST(req: NextRequest) {
  const requestId = Math.random().toString(36).substring(7);
  const { prompt, provider, modelId, userEmail, plan } =
    (await req.json()) as GenerateImageRequest & { userEmail: string; plan?: string };

  try {
    if (!prompt || !provider || !modelId || !providerConfig[provider] || !userEmail) {
      const error = "Invalid request parameters";
      console.error(`${error} [requestId=${requestId}]`);
      return NextResponse.json({ error }, { status: 400 });
    }

    const config = providerConfig[provider];
    const startstamp = performance.now();

    // --- Call Render backend instead of local generateImage ---
    const backendPromise = fetch(BACKEND_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt,
        user_id: userEmail,
        plan: plan || "free",
      }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);

        console.log(
          `Completed image request via backend [requestId=${requestId}, provider=${provider}, model=${modelId}, elapsed=${(
            (performance.now() - startstamp) /
            1000
          ).toFixed(1)}s].`
        );

        return {
          provider: "pollinations-backend",
          image: data.image,
          remaining: data.remaining,
          plan: data.plan,
        };
      });

    const result = await withTimeout(backendPromise, TIMEOUT_MILLIS);

    return NextResponse.json(result, {
      status: "image" in result ? 200 : 500,
    });
  } catch (error) {
    console.error(
      `Error generating image [requestId=${requestId}, provider=${provider}, model=${modelId}]: `,
      error
    );
    return NextResponse.json(
      { error: "Failed to generate image. Please try again later." },
      { status: 500 }
    );
  }
}
