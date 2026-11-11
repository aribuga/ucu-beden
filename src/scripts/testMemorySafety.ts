import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import type { MemoryTrace, SourceBundle } from "../lib/types";

// Preserve the original exhaustive matcher as an oracle. In particular, these
// are Turkish-aware boundaries, not JavaScript's ASCII-only \b boundaries.
function originalTermMatches(text: string, terms: string[]): string[] {
  const value = text.toLocaleLowerCase("tr").replace(/\s+/gu, " ").trim();
  return terms.filter((term) => {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    return new RegExp(`(^|[^a-zçğıöşü0-9])${escaped}([^a-zçğıöşü0-9]|$)`, "u").test(value);
  });
}

function distinct(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean)));
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const fixtureDir = await mkdtemp(path.join(tmpdir(), "ucu-memory-safety-"));
  try {
    // Storage captures cwd on import. Keep the test independent of the user's
    // real archive, and never modify its source, poem, or memory files.
    process.chdir(fixtureDir);
    const { externalIntakeUnsafePublicTerms, unsafeExternalIntakeTextMatches } = await import("../lib/codexExternalIntakeMemory");
    const { filterPublicSafeMemoryTraces, validateMemoryPromptFragments } = await import("../lib/memoryTraceEngine");

    const terms = ["izmir", "ışık", "şehir", "kedi", "kedi evi", "evi", "c++", "a.b", "[iz]", "(ses)", "a|b", "x*", "a\\b", "?", "", "kedi"];
    const fragments = [
      "İZMİR ve IŞIK", "İzmir'in ışığı", "kedi", "(kedi)", "kediler", "önkedi", "2kedi", "kedi3",
      "kedi\n  evi", "c++ a.b [iz] (ses) a|b x* a\\b ?", "aXb", "àkedié", "😀kedi😀", "", "   ",
      "https://example.test", "www.example.test", "hello@example.test", "payment code", "Gmail newsletter"
    ];
    // Cover boundary combinations deterministically without timing assertions.
    for (const term of terms) {
      for (const before of ["", " ", "ç", "ı", "9", "'", "(", "é"]) {
        for (const after of ["", " ", "ş", "i", "0", "'", ")", "😀"]) {
          fragments.push(`${before}${term}${after}`);
        }
      }
    }
    for (const fragment of fragments) {
      const specialMatches = unsafeExternalIntakeTextMatches(fragment, []);
      const expected = distinct([...specialMatches, ...originalTermMatches(fragment, terms)]);
      assert.deepEqual(unsafeExternalIntakeTextMatches(fragment, terms), expected, `external matcher: ${JSON.stringify(fragment)}`);
    }
    assert.ok(unsafeExternalIntakeTextMatches("https://example.test", []).includes("url_or_contact"));
    assert.ok(unsafeExternalIntakeTextMatches("payment code", []).includes("sensitive_operational_text"));
    assert.ok(unsafeExternalIntakeTextMatches("Gmail newsletter", []).includes("source_format_term"));

    const providerTerms = terms.filter((term) => term.length >= 3);
    const sources = providerTerms.map((provider) => ({
      weather: { provider }, turkey_news: { provider }, art_world: { provider }
    })) as SourceBundle[];
    const regions = new Intl.DisplayNames(["tr"], { type: "region" });
    const countryTerms: string[] = [];
    for (const first of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
      for (const second of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") {
        const code = `${first}${second}`;
        const name = regions.of(code);
        if (name && name !== code) countryTerms.push(name);
      }
    }
    const sourceTerms = distinct([...providerTerms, ...countryTerms]
      .map((term) => term.toLocaleLowerCase("tr").replace(/\s+/g, " ").trim())
      .filter((term) => term.length >= 3 && !/^\d+$/.test(term)))
      .sort((a, b) => b.length - a.length);
    const externalTerms = externalIntakeUnsafePublicTerms([]);
    fragments.push("Türkiye", "TÜRKİYE", "kedi", "sakin bir pencere");
    const urlPattern = /https?:\/\/|www\.|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i;
    const expectedUnsafe = fragments.map((fragment) => ({
      fragment,
      matches: distinct([
        ...(urlPattern.test(fragment) ? ["url_or_contact"] : []),
        ...originalTermMatches(fragment, sourceTerms),
        ...unsafeExternalIntakeTextMatches(fragment, externalTerms)
      ])
    })).filter((item) => item.matches.length > 0);
    const unsafeSet = new Set(expectedUnsafe.map((item) => item.fragment));
    const result = await validateMemoryPromptFragments(fragments, sources);
    assert.deepEqual(result, {
      valid: expectedUnsafe.length === 0,
      safe_fragments: distinct(fragments.filter((fragment) => !unsafeSet.has(fragment))),
      unsafe_fragments: expectedUnsafe
    });

    const traces = fragments.map((text, index) => ({ id: `fixture-${index}`, text, transformed_text: text })) as MemoryTrace[];
    const expectedTraces = traces.filter((trace) => {
      const text = `${trace.text} ${trace.transformed_text}`;
      return !urlPattern.test(text) && originalTermMatches(text, sourceTerms).length === 0 &&
        unsafeExternalIntakeTextMatches(text, externalTerms).length === 0;
    });
    assert.deepEqual(await filterPublicSafeMemoryTraces(traces, sources), expectedTraces);
    assert.deepEqual(await validateMemoryPromptFragments([], sources), { valid: true, safe_fragments: [], unsafe_fragments: [] });
    assert.deepEqual(await validateMemoryPromptFragments(["sakin bir pencere", "sakin bir pencere"], sources), {
      valid: true, safe_fragments: ["sakin bir pencere"], unsafe_fragments: []
    });
    const mixedTraces = [
      { id: "unsafe-original", text: "İzmir", transformed_text: "sakin bir pencere" },
      { id: "unsafe-transformed", text: "sakin bir pencere", transformed_text: "İzmir" },
      { id: "safe", text: "sakin bir pencere", transformed_text: "sakin bir pencere" }
    ] as MemoryTrace[];
    assert.deepEqual(await filterPublicSafeMemoryTraces(mixedTraces, sources), [mixedTraces[2]]);
    console.log(`Memory safety regression checks passed for ${fragments.length} fragments and traces.`);
  } finally {
    process.chdir(cwd);
    await rm(fixtureDir, { recursive: true, force: true });
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
