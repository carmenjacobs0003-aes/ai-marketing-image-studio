try {
  await updateImageGeneration(supabase, generation.id, user.id, {
    status: "processing"
  });

  const brandedPrompt = injectBrandIntoImagePrompt(
    payload.prompt,
    brandKit
  );

  const image = await withTimeout(
    createMarketingImage({
      prompt: brandedPrompt,
      size: payload.size,
      quality: payload.quality
    }),
    env.API_TIMEOUT_SECONDS * 1000
  );

  if (!image) {
    throw new Error("OpenAI returned an empty response");
  }

  if (!image.data || !Array.isArray(image.data) || !image.data[0]) {
    throw new Error("Invalid image response from OpenAI");
  }

  const base64Image = getGeneratedImageBase64(image);

  if (!base64Image) {
    throw new Error("No image data returned from OpenAI");
  }

  const storagePath = await uploadGeneratedImage(
    user.id,
    generation.id,
    base64Image
  );

  await updateImageGeneration(supabase, generation.id, user.id, {
    status: "completed",
    storage_path: storagePath,
    metadata: {
      moderation: moderationMetadata,
      size: payload.size,
      quality: payload.quality,
      openai_created: image.created ?? null,
      revised_prompt: image.data?.[0]?.revised_prompt ?? null,
      brand_kit_id: brandKit?.id ?? null
    }
  });

  await recordSuccessfulUsage(user.id, "image_generations");

  logger.info("Image generation completed", {
    userId: user.id,
    generationId: generation.id,
    durationMs: Date.now() - startedAt,
    size: payload.size,
    quality: payload.quality
  });

  const [signedUrl, downloadUrl] = await Promise.all([
    createSignedImageUrl(storagePath),
    createSignedDownloadUrl(storagePath)
  ]);

  return NextResponse.json(
    {
      id: generation.id,
      prompt: payload.prompt,
      projectId: payload.projectId ?? null,
      storagePath,
      signedUrl,
      downloadUrl
    },
    { status: 201 }
  );
} catch (error) {
  const message =
    error instanceof Error ? error.message : "Image generation failed";

  await updateImageGeneration(supabase, generation.id, user.id, {
    status: "failed",
    error_message: message
  });

  await logCentralizedError(error, {
    category: "generation",
    provider: "openai",
    message,
    userId: user.id,
    requestId: request.headers.get("x-request-id"),
    severity: "critical",
    context: {
      generationId: generation.id,
      durationMs: Date.now() - startedAt,
      size: payload.size,
      quality: payload.quality
    }
  });

  return NextResponse.json(
    {
      error: message,
      fallback:
        "Generation was safely marked failed. Your quota was not consumed; revise or retry when the provider recovers."
    },
    { status: 500 }
  );
}
