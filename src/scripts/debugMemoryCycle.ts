import { getLatestPoem, listDreams, listGeneratedPoems, listSources, readDailyLife, readInputAnalysis, readPersonalitySettings, readState, readWorld } from "../lib/fileStorage";
import { generationContextDebug, type GenerationContextPacketInput } from "../lib/generationContextPacket";
import { validateMemoryCycleIntegrity } from "../lib/memoryCycle";
import { buildMemoryGraphData } from "../lib/memoryGraph";
import {
  buildMemoryArchive,
  memoryArchiveStateSignature,
  previewMemoryCycleEffects,
  selectMemoryForGeneration,
  validateMemoryArchive,
  validateMemoryPromptFragments
} from "../lib/memoryTraceEngine";
import { analyzeRepetitionPressure } from "../lib/repetitionPressure";
import { analyzeSourceDigest, validateSourceInfluence } from "../lib/sourceInfluence";
import { buildDreamPromptSections } from "../lib/dreamEngine";
import { buildPoemPromptSections } from "../lib/poemGenerator";
import type { GenerationContext, MemoryReport, MemorySelection } from "../lib/types";
import { buildUcuBedenVoicePrompt } from "../lib/ucuBedenVoicePrompt";

function nextDate(date: string | null): string {
  const value = new Date(`${date ?? new Date().toISOString().slice(0, 10)}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + 1);
  return value.toISOString().slice(0, 10);
}

function requestedDate(args: string[], fallback: string): string {
  const inline = args.find((arg) => arg.startsWith("--date="))?.slice("--date=".length);
  const position = args.indexOf("--date");
  const value = inline ?? (position >= 0 ? args[position + 1] : undefined) ?? fallback;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`Invalid --date value: ${value}`);
  return value;
}

function selectionSummary(selection: MemorySelection) {
  return {
    selected_trace_ids: selection.selected_trace_ids,
    direct_trace_count: selection.direct_trace_ids.length,
    indirect_trace_count: selection.indirect_trace_ids.length,
    suppressed_trace_count: selection.suppressed_trace_ids.length,
    direct_trace_ids: selection.direct_trace_ids,
    indirect_trace_ids: selection.indirect_trace_ids,
    suppressed_trace_ids: selection.suppressed_trace_ids,
    memory_prompt_fragments: selection.memory_prompt_fragments
  };
}

function reportChange(before: MemoryReport, after: MemoryReport) {
  const sections = ["easily_recalled", "suppressed", "external_leakage", "dream_returns", "indirect_only"] as const;
  return {
    climate_delta: Object.fromEntries(
      Object.keys(before.climate).map((key) => {
        const dimension = key as keyof MemoryReport["climate"];
        return [key, Math.round((after.climate[dimension].value - before.climate[dimension].value) * 1000) / 1000];
      })
    ),
    section_count_delta: Object.fromEntries(sections.map((key) => [key, after[key].length - before[key].length]))
  };
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  if (args.includes("--write")) throw new Error("debug:memory-cycle is read-only and does not support --write.");
  const archive = await buildMemoryArchive();
  const repeatedArchive = await buildMemoryArchive();
  const [latestPoem, poems, dreams, sources, repetition, state, world, inputAnalysis, personality] = await Promise.all([
    getLatestPoem(),
    listGeneratedPoems(),
    listDreams(),
    listSources(),
    analyzeRepetitionPressure(),
    readState(),
    readWorld(),
    readInputAnalysis(),
    readPersonalitySettings()
  ]);
  const latestDailyLife = latestPoem ? await readDailyLife(latestPoem.date) : null;
  const date = requestedDate(args, nextDate(archive.index.built_through));
  const mood = latestPoem?.mood ?? { melancholy: 0, anger: 0, tenderness: 0, fatigue: 0, absurdity: 0, clarity: 0, desire: 0, hope: 0 };
  const [poemSelection, dreamSelection] = await Promise.all([
    selectMemoryForGeneration({ date, mood, mode: "poem", repetition, traces: archive.traces, sources }),
    selectMemoryForGeneration({ date, mood, mode: "dream", repetition, traces: archive.traces, sources })
  ]);
  const [poemGuard, dreamGuard, archiveValidation, graphBefore] = await Promise.all([
    validateMemoryPromptFragments(poemSelection.memory_prompt_fragments, sources),
    validateMemoryPromptFragments(dreamSelection.memory_prompt_fragments, sources),
    validateMemoryArchive(archive, sources),
    buildMemoryGraphData({ traces: archive.traces, report: archive.report, index: archive.index, poems, dreams, sources })
  ]);
  const projection = previewMemoryCycleEffects({
    date,
    recalled_at: `${date}T12:00:00.000Z`,
    traces: archive.traces,
    poem_selection: poemSelection,
    dream_selection: dreamSelection,
    sources
  });
  const graphAfter = await buildMemoryGraphData({
    traces: projection.traces,
    report: projection.report,
    index: projection.index,
    poems,
    dreams,
    sources
  });
  const cycleValidation = await validateMemoryCycleIntegrity({
    archive,
    poems,
    dreams,
    sources,
    poem_preview: poemSelection,
    dream_preview: dreamSelection
  });
  const poemVoice = buildUcuBedenVoicePrompt({ mode: "poem" });
  const dreamVoice = buildUcuBedenVoicePrompt({ mode: "dream" });
  const sourceDigest = analyzeSourceDigest(sources);
  const sourceInfluenceValidation = validateSourceInfluence(sources);
  const generationContext =
    latestPoem && latestDailyLife
      ? (() => {
          const poemInput: GenerationContextPacketInput = {
            mode: "poem",
            date,
            mood,
            sources: latestPoem.sources,
            daily_life: latestDailyLife,
            walk_state: latestPoem.walk_state,
            memory_selection: poemSelection,
            repetition_pressure: repetition,
            state,
            genetic_style_note: inputAnalysis.global.style_notes
          };
          const dreamInput: GenerationContextPacketInput = { ...poemInput, mode: "dream", memory_selection: dreamSelection, poem: latestPoem };
          const poemContext: GenerationContext = {
            date,
            age_months: latestPoem.age_months,
            age_display: latestPoem.age_display,
            state,
            world,
            sources: latestPoem.sources,
            input_analysis: inputAnalysis,
            mood,
            mood_sentence: latestPoem.mood_sentence,
            daily_life: latestDailyLife,
            walk_state: latestPoem.walk_state,
            personality_settings: personality,
            memory_fragments: poemSelection.memory_prompt_fragments,
            memory_selection: poemSelection,
            repetition_pressure: repetition
          };
          const dreamParams = { date, poem: latestPoem, dailyLife: latestDailyLife, state, repetition, memorySelection: dreamSelection };
          return {
            poem: { ...generationContextDebug(poemInput), prompt_sections: buildPoemPromptSections(poemContext) },
            dream: { ...generationContextDebug(dreamInput), prompt_sections: buildDreamPromptSections(dreamParams) }
          };
        })()
      : null;
  const generationContextValidation = {
    valid:
      generationContext === null ||
      [generationContext.poem, generationContext.dream].every(
        (item) =>
          item.raw_json_context_removed &&
          item.home_place_deanchored &&
          item.source_influence_packet_present &&
          item.fallback_surface_safe
      ),
    available: generationContext !== null
  };

  console.log(
    JSON.stringify(
      {
        status: "preview",
        writes_performed: false,
        preview_date: date,
        deterministic_rebuild: {
          valid: memoryArchiveStateSignature(archive) === memoryArchiveStateSignature(repeatedArchive),
          first_memory_state_signature: memoryArchiveStateSignature(archive),
          second_memory_state_signature: memoryArchiveStateSignature(repeatedArchive)
        },
        poem_mode: selectionSummary(poemSelection),
        generation_voice: {
          poem: {
            persona_voice_prompt: poemVoice.persona_voice_prompt,
            surface_constraints: poemVoice.surface_constraints,
            source_influence_constraints: poemVoice.source_influence_constraints,
            sarcasm_settings: poemVoice.sarcasm_settings,
            voice_constraints: poemVoice.voice_constraints,
            mode_constraints: poemVoice.mode_constraints
          },
          dream: {
            persona_voice_prompt: dreamVoice.persona_voice_prompt,
            surface_constraints: dreamVoice.surface_constraints,
            source_influence_constraints: dreamVoice.source_influence_constraints,
            sarcasm_settings: dreamVoice.sarcasm_settings,
            voice_constraints: dreamVoice.voice_constraints,
            mode_constraints: dreamVoice.mode_constraints
          }
        },
        source_digest: {
          ...sourceDigest,
          validation: sourceInfluenceValidation
        },
        generation_context: generationContext,
        generation_context_validation: generationContextValidation,
        poem_prompt_guard: {
          valid: poemGuard.valid,
          safe_fragment_count: poemGuard.safe_fragments.length,
          unsafe_fragment_count: poemGuard.unsafe_fragments.length,
          unsafe_matches: poemGuard.unsafe_fragments.map((item) => item.matches)
        },
        dream_mode: selectionSummary(dreamSelection),
        dream_prompt_guard: {
          valid: dreamGuard.valid,
          safe_fragment_count: dreamGuard.safe_fragments.length,
          unsafe_fragment_count: dreamGuard.unsafe_fragments.length,
          unsafe_matches: dreamGuard.unsafe_fragments.map((item) => item.matches)
        },
        dream_return_candidates: projection.dream_return_candidates,
        recall_update_preview: projection.recall_updates,
        memory_report_change_preview: reportChange(archive.report, projection.report),
        graph_change_preview: {
          public_node_count_before: graphBefore.nodes.length,
          public_node_count_after_recall_only: graphAfter.nodes.length,
          public_node_delta_after_recall_only: graphAfter.nodes.length - graphBefore.nodes.length,
          linked_edge_count_before: graphBefore.edges.length,
          linked_edge_count_after_recall_only: graphAfter.edges.length,
          linked_edge_delta_after_recall_only: graphAfter.edges.length - graphBefore.edges.length,
          dream_return_edges_pending_generated_dream: projection.dream_return_candidates.length,
          generated_trace_nodes_pending: ["poem", "dream"]
        },
        generation_metadata_contract: {
          poem_fields: Object.keys(poemSelection).sort(),
          dream_fields: Object.keys(dreamSelection).sort(),
          preview_metadata_complete: cycleValidation.preview_metadata_complete,
          selected_ids_resolve: cycleValidation.unresolved_selected_trace_ids.length === 0,
          stored_metadata_records: cycleValidation.metadata_records
        },
        unsafe_public_text: archiveValidation.unsafe_public_text,
        unsafe_prompt_fragments: cycleValidation.unsafe_prompt_fragments,
        cycle_validation: cycleValidation
      },
      null,
      2
    )
  );
  if (
    !archiveValidation.valid ||
    !cycleValidation.valid ||
    !sourceInfluenceValidation.valid ||
    !generationContextValidation.valid ||
    !poemGuard.valid ||
    !dreamGuard.valid ||
    memoryArchiveStateSignature(archive) !== memoryArchiveStateSignature(repeatedArchive)
  ) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
