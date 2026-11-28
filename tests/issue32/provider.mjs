// Loaded only by the offline regression runner. Every fetch ends here.
let poemCalls = 0;
globalThis.fetch = async (input, init) => {
  const url = String(input);
  if (!url.startsWith("https://api.openai.com/")) return new Response("", { status: 503 });
  const quota = () => Response.json({ error: { code: "insufficient_quota" } }, { status: 429 });
  if (url.includes("/images/")) {
    console.log("fixture:image");
    if (process.env.FIXTURE_MODE === "image_ok") return Response.json({data:[{b64_json:process.env.FIXTURE_IMAGE}]});
    return quota();
  }
  const name = JSON.parse(init.body).text?.format?.name;
  const mode = process.env.FIXTURE_MODE;
  let payload;
  if (name === "ucu_beden_daily_poem") {
    console.log("fixture:poem");
    poemCalls++;
    if (mode === "quota") return quota();
    if (mode === "temporary" && poemCalls === 1) return Response.json({error:{code:"rate_limit_exceeded"}}, {status:429, headers:{"Retry-After":"0"}});
    payload = mode === "severe" ? { poem:"the world and the sky", mood_sentence:"the sky" } : mode === "invalid" ? {} : { poem:"Zümrüdün kıvrımı çözülüyor\nKeten gömleğimde bir çiy", mood_sentence:"Kirpiğimde çiy duruyor." };
  } else if (name === "ucu_beden_dream") {
    console.log("fixture:dream");
    if (mode === "quota") return quota();
    payload = { title:"Lacivert kıymık", dream_text:"Turnalar gümüşü eğiriyor.", mood_after:"Dinginim.", symbols:["turna"], memory_mutations:[] };
  } else if (name?.includes("title")) payload = { title:"Zümrüdün kıvrımı" };
  else return quota();
  return Response.json({output_text:JSON.stringify(payload)});
};
